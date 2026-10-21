
const { Pool } = require('pg');
const { unpack, cookies } = require('./auth/discord/_shared');

let pool;

function db() {
  if (!process.env.DATABASE_URL) {
    throw Error('Database not configured');
  }

  return pool || (pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3
  }));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = unpack(cookies(req).discord_session);

  if (
    !session ||
    session.exp < Date.now() ||
    !/^[0-9]+$/.test(String(session.id || ''))
  ) {
    return res.status(401).json({
      error: 'Discord login required'
    });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      error: 'Wallet database not configured'
    });
  }

  let client;

  try {
    client = await db().connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS discord_wallets (
        discord_id TEXT PRIMARY KEY,
        balance BIGINT NOT NULL DEFAULT 100
          CHECK (balance >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE discord_wallets
      ADD COLUMN IF NOT EXISTS last_daily_bonus DATE
    `);

    await client.query('ALTER TABLE discord_wallets ADD COLUMN IF NOT EXISTS username TEXT');

    // Create a new wallet with the 100-coin welcome bonus.
    await client.query(`
      INSERT INTO discord_wallets (discord_id, username)
      VALUES ($1, $2)
      ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username
    `, [session.id, String(session.username || 'Discord user').slice(0,80)]);

    // Atomic daily bonus: +50 coins, once per JST calendar day.
    const result = await client.query(`
      UPDATE discord_wallets
      SET
        balance = balance + 50,
        last_daily_bonus =
          (NOW() AT TIME ZONE 'Asia/Tokyo')::date
      WHERE discord_id = $1
        AND (
          last_daily_bonus IS NULL
          OR last_daily_bonus <
            (NOW() AT TIME ZONE 'Asia/Tokyo')::date
        )
      RETURNING balance
    `, [session.id]);

    if (result.rowCount > 0) {
      return res.status(200).json({
        balance: Number(result.rows[0].balance),
        dailyBonus: 50,
        currency: 'demo_coins'
      });
    }

    const wallet = await client.query(`
      SELECT balance
      FROM discord_wallets
      WHERE discord_id = $1
    `, [session.id]);

    return res.status(200).json({
      balance: Number(wallet.rows[0].balance),
      dailyBonus: 0,
      currency: 'demo_coins'
    });

  } catch (error) {
    console.error('Wallet lookup failed', error);

    return res.status(503).json({
      error: 'Wallet temporarily unavailable'
    });

  } finally {
    if (client) client.release();
  }
};

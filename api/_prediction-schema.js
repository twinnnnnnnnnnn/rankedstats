// Shared prediction database schema. Safe to run repeatedly.
async function ensurePredictionTables(client) {
 await client.query(`CREATE TABLE IF NOT EXISTS ranked_predictions (
  id BIGSERIAL PRIMARY KEY,
  discord_id TEXT NOT NULL,
  player_uuid TEXT NOT NULL,
  player_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('gain','loss')),
  stake BIGINT NOT NULL CHECK (stake > 0),
  odds_basis_points INTEGER NOT NULL CHECK (odds_basis_points >= 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','refunded')),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  jst_day DATE NOT NULL,
  settlement_after TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  result_elo INTEGER,
  payout BIGINT NOT NULL DEFAULT 0
 )`);
 await client.query('CREATE INDEX IF NOT EXISTS ranked_predictions_pending_idx ON ranked_predictions (status, placed_at)');
 await client.query('CREATE INDEX IF NOT EXISTS ranked_predictions_user_day_idx ON ranked_predictions (discord_id, jst_day)');
}
module.exports={ensurePredictionTables};

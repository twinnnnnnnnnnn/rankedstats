// Shared prediction database schema. Safe to run repeatedly.
async function ensurePredictionTables(client) {
 await client.query(`CREATE TABLE IF NOT EXISTS ranked_predictions (
  id BIGSERIAL PRIMARY KEY,
  discord_id TEXT NOT NULL,
  player_uuid TEXT NOT NULL,
  player_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('gain','loss','faster','slower')),
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
 await client.query("ALTER TABLE ranked_predictions ADD COLUMN IF NOT EXISTS baseline_avg_ms DOUBLE PRECISION");
 await client.query("ALTER TABLE ranked_predictions ADD COLUMN IF NOT EXISTS result_avg_ms DOUBLE PRECISION");
 // Migrate the legacy Elo-only constraint once, not on every API request.
 const constraint=await client.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='ranked_predictions'::regclass AND conname='ranked_predictions_direction_check'");
 if(constraint.rows.length&&!/faster/.test(constraint.rows[0].definition)){
  await client.query("ALTER TABLE ranked_predictions DROP CONSTRAINT ranked_predictions_direction_check");
  await client.query("ALTER TABLE ranked_predictions ADD CONSTRAINT ranked_predictions_direction_check CHECK (direction IN ('gain','loss','faster','slower'))");
 }
 await client.query('CREATE INDEX IF NOT EXISTS ranked_predictions_pending_idx ON ranked_predictions (status, placed_at)');
 await client.query('CREATE INDEX IF NOT EXISTS ranked_predictions_user_day_idx ON ranked_predictions (discord_id, jst_day)');
 // Enforce one prediction per player per Discord account per JST day at the database level.
 await client.query('CREATE UNIQUE INDEX IF NOT EXISTS ranked_predictions_unique_player_day_idx ON ranked_predictions (discord_id, jst_day, player_uuid)');
}
module.exports={ensurePredictionTables};

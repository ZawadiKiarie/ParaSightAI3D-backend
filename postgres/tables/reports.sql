BEGIN TRANSACTION;

CREATE TABLE reports (
  id serial PRIMARY KEY,

  report_id text UNIQUE NOT NULL,
  sample_id text NOT NULL,

  user_id integer REFERENCES users(id) ON DELETE SET NULL,

  parasite_name text NOT NULL,
  parasite_id text,
  stage text,
  stage_source text,

  confidence numeric(6, 2),
  status text DEFAULT 'Pending Review',

  image_url text NOT NULL,
  image_filename text,
  image_resolution text,

  processing_time_ms integer,
  processing_time text,

  bbox jsonb,
  all_detections jsonb,

  notes text DEFAULT 'AI-assisted parasite detection completed. Result should be reviewed by qualified laboratory personnel before clinical interpretation.',

  created_at timestamp NOT NULL DEFAULT NOW()
);

COMMIT;
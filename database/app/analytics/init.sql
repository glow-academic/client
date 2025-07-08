CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE components (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  file_name   TEXT        NOT NULL,
  layout JSONB       NOT NULL DEFAULT '{}', -- extra props for the component and metadata
  stat BOOLEAN NOT NULL DEFAULT FALSE, -- if this is a statistic
  default_component      BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE dashboards (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    profile_id   UUID        NULL REFERENCES profiles(id) ON DELETE CASCADE, -- NULL for global dashboards
    header_component_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- order matters
    primary_component_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- order matters
    secondary_component_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- order matters
    footer_component_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- order matters
    auto_scroll BOOLEAN NOT NULL DEFAULT FALSE,
    show_indicators BOOLEAN NOT NULL DEFAULT TRUE,
    header_components INTEGER NOT NULL DEFAULT 3, -- number of components in the header
    main_split FLOAT NOT NULL DEFAULT 0.65, -- number 0-1 for split between primary and secondary
    footer_split FLOAT NOT NULL DEFAULT 0.5 -- number 0-1 for split between footer section
);

-- ============================================================================
-- INSERT COMPONENTS
-- ============================================================================

INSERT INTO components (id, name, description, file_name, layout, stat, default_component) VALUES
  ('49990ffa-5698-bd91-b379-6703a8cf4835', 'Cohort Completion', 'Analytics component for cohort completion', 'CohortCompletion.tsx', '{"props":{"className":""},"metadata":{"className":{"type":"string"}}}', false, false),
  ('d8e58a90-32e7-0b43-447c-fda790891cee', 'Scenario Data', 'Analytics component for scenario data', 'ScenarioData.tsx', '{"props":{"className":""},"metadata":{"className":{"type":"string"}}}', false, false),
  ('6b8684a8-cd06-6f6a-9a53-d57ad527041b', 'Simulation Performance', 'Analytics component for simulation performance', 'SimulationPerformance.tsx', '{"props":{"className":"","color":"blue","defaultSelection":"all","chartType":"bar","title":"Simulation Performance","showSelector":true},"metadata":{"className":{"type":"string"},"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"defaultSelection":{"type":"string"},"chartType":{"type":"select","options":["bar"],"multiple":false},"title":{"type":"string"},"showSelector":{"type":"boolean"}}}', false, false),
  ('2e3380af-e6a2-6080-ceee-1c91b65121c4', 'Skill Growth', 'Analytics component for skill growth', 'SkillGrowth.tsx', '{"props":{"className":""},"metadata":{"className":{"type":"string"}}}', false, false),
  ('595e7002-360b-afce-83bd-3164dfc7a203', 'Active Cohorts', 'Analytics component for active cohorts', 'ActiveCohorts.tsx', '{"props":{"color":"blue","timeRange":"30d","title":"Active Cohorts","showDialog":true},"metadata":{"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"timeRange":{"type":"select","options":["7d","30d","90d"],"multiple":false},"title":{"type":"string"},"showDialog":{"type":"boolean"}}}', true, false),
  ('71c51fa2-e117-853b-4da5-2de4ee328c7d', 'Average Score', 'Analytics component for average score', 'AverageScore.tsx', '{"props":{"color":"emerald","timeRange":"30d","title":"Average Score","showDialog":true},"metadata":{"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"timeRange":{"type":"select","options":["7d","30d","90d"],"multiple":false},"title":{"type":"string"},"showDialog":{"type":"boolean"}}}', true, false),
  ('25c97e74-2e60-efeb-0277-b57c7ce720e1', 'Completion Rate', 'Analytics component for completion rate', 'CompletionRate.tsx', '{"props":{"color":"teal","timeRange":"7d","title":"Completion Rate","showDialog":true},"metadata":{"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"timeRange":{"type":"select","options":["7d","30d","90d"],"multiple":false},"title":{"type":"string"},"showDialog":{"type":"boolean"}}}', true, false),
  ('7b058d9e-2968-3e69-4ff7-8bc7a13e5cfc', 'Need Support', 'Analytics component for need support', 'NeedSupport.tsx', '{"props":{"color":"red","timeRange":"30d","title":"Need Support","showDialog":true},"metadata":{"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"timeRange":{"type":"select","options":["7d","30d","90d"],"multiple":false},"title":{"type":"string"},"showDialog":{"type":"boolean"}}}', true, false),
  ('32aae137-f974-5b45-60eb-6b9b2eca6433', 'Pass Rate', 'Analytics component for pass rate', 'PassRate.tsx', '{"props":{"color":"emerald","timeRange":"7d","title":"Pass Rate","showDialog":true},"metadata":{"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"timeRange":{"type":"select","options":["7d","30d","90d"],"multiple":false},"title":{"type":"string"},"showDialog":{"type":"boolean"}}}', true, false),
  ('c3bebe15-6231-0b14-704a-67545389be60', 'Total Sessions', 'Analytics component for total sessions', 'TotalSessions.tsx', '{"props":{"color":"teal","timeRange":"30d","title":"Total Sessions","showDialog":true},"metadata":{"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"timeRange":{"type":"select","options":["7d","30d","90d"],"multiple":false},"title":{"type":"string"},"showDialog":{"type":"boolean"}}}', true, false),
  ('e412e43b-468c-489c-f262-1607bc64dc43', 'Total Tas', 'Analytics component for total tas', 'TotalTas.tsx', '{"props":{"color":"purple","timeRange":"30d","title":"Total TAs","showDialog":true},"metadata":{"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"timeRange":{"type":"select","options":["7d","30d","90d"],"multiple":false},"title":{"type":"string"},"showDialog":{"type":"boolean"}}}', true, false),
  ('71724c23-ef68-189d-94b3-8ed2c8ffded3', 'Training Hours', 'Analytics component for training hours', 'TrainingHours.tsx', '{"props":{"color":"orange","timeRange":"30d","title":"Training Hours","showDialog":true},"metadata":{"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"timeRange":{"type":"select","options":["7d","30d","90d"],"multiple":false},"title":{"type":"string"},"showDialog":{"type":"boolean"}}}', true, false),
  ('654ffdaa-be1f-8f87-c2ac-5a11b7076c8f', 'Training Sessions', 'Analytics component for training sessions', 'TrainingSessions.tsx', '{"props":{"color":"green","timeRange":"7d","title":"Training Sessions","showDialog":true},"metadata":{"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"timeRange":{"type":"select","options":["7d","30d","90d"],"multiple":false},"title":{"type":"string"},"showDialog":{"type":"boolean"}}}', true, false),
  ('bab2e342-c823-2e94-a85a-816d9cb78bd2', 'Performance By Personality', 'Analytics component for performance by personality', 'PerformanceByPersonality.tsx', '{"props":{"className":"","color":"blue","defaultTimeRange":"30d","chartType":"bar","title":"Performance by Personality","showTimeSelector":true},"metadata":{"className":{"type":"string"},"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"defaultTimeRange":{"type":"select","options":["7d","14d","30d","60d","90d"],"multiple":false},"chartType":{"type":"select","options":["bar"],"multiple":false},"title":{"type":"string"},"showTimeSelector":{"type":"boolean"}}}', false, false),
  ('a7e8e793-011f-b291-eec4-a74232db4491', 'Performance Trends', 'Analytics component for performance trends', 'PerformanceTrends.tsx', '{"props":{"className":"","color":"blue","defaultTimeRange":"30d","chartType":"area","title":"Performance Trends","showTimeSelector":true},"metadata":{"className":{"type":"string"},"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"defaultTimeRange":{"type":"select","options":["7d","30d","90d"],"multiple":false},"chartType":{"type":"select","options":["area","line"],"multiple":false},"title":{"type":"string"},"showTimeSelector":{"type":"boolean"}}}', false, false),
  ('c2940e17-d668-43e3-ad76-9abf53d5b21f', 'Session Activity', 'Analytics component for session activity', 'SessionActivity.tsx', '{"props":{"className":"","color":"blue","defaultTimeRange":"24h","chartType":"bar","title":"Session Activity","showTimeSelector":true},"metadata":{"className":{"type":"string"},"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"defaultTimeRange":{"type":"select","options":["1h","12h","24h","1d","3d","7d","14d","30d"],"multiple":false},"chartType":{"type":"select","options":["bar"],"multiple":false},"title":{"type":"string"},"showTimeSelector":{"type":"boolean"}}}', false, false),
  ('2a27f6d4-e6a9-f2fd-d691-7de103d7c443', 'Class Performance', 'Analytics component for class performance', 'ClassPerformance.tsx', '{"props":{"className":"","color":"blue","maxItems":5,"title":"Class Performance","layout":"vertical"},"metadata":{"className":{"type":"string"},"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"maxItems":{"type":"number"},"title":{"type":"string"},"layout":{"type":"select","options":["vertical","horizontal"],"multiple":false}}}', false, false),
  ('ce392c42-3858-091d-cd39-3fc69bca92c2', 'Skill Breakdown', 'Analytics component for skill breakdown', 'SkillBreakdown.tsx', '{"props":{"className":"","color":"blue","maxItems":4,"title":"Skill Breakdown","layout":"vertical"},"metadata":{"className":{"type":"string"},"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"maxItems":{"type":"number"},"title":{"type":"string"},"layout":{"type":"select","options":["vertical","horizontal"],"multiple":false}}}', false, false),
  ('e5fd9fa5-5da1-7262-f40a-c2300888e1ad', 'Training Insights', 'Analytics component for training insights', 'TrainingInsights.tsx', '{"props":{"className":"","color":"blue","maxItems":4,"title":"Training Insights","layout":"vertical"},"metadata":{"className":{"type":"string"},"color":{"type":"select","options":["blue","green","purple","orange","teal","red","emerald","indigo"],"multiple":false},"maxItems":{"type":"number"},"title":{"type":"string"},"layout":{"type":"select","options":["vertical","horizontal"],"multiple":false}}}', false, false);

-- ============================================================================
-- INSERT SAMPLE DASHBOARD
-- ============================================================================

INSERT INTO dashboards (
  id, 
  profile_id, 
  header_component_ids, 
  primary_component_ids, 
  secondary_component_ids, 
  footer_component_ids,
  auto_scroll,
  show_indicators,
  header_components,
  main_split,
  footer_split
) VALUES (
  'cc105744-d671-e556-c44d-3114be8cecd0',
  NULL, -- Global dashboard
  ARRAY['595e7002-360b-afce-83bd-3164dfc7a203', '71c51fa2-e117-853b-4da5-2de4ee328c7d', '25c97e74-2e60-efeb-0277-b57c7ce720e1', '7b058d9e-2968-3e69-4ff7-8bc7a13e5cfc', '32aae137-f974-5b45-60eb-6b9b2eca6433', 'c3bebe15-6231-0b14-704a-67545389be60', 'e412e43b-468c-489c-f262-1607bc64dc43', '71724c23-ef68-189d-94b3-8ed2c8ffded3', '654ffdaa-be1f-8f87-c2ac-5a11b7076c8f']::UUID[],
  ARRAY['bab2e342-c823-2e94-a85a-816d9cb78bd2', 'a7e8e793-011f-b291-eec4-a74232db4491', 'c2940e17-d668-43e3-ad76-9abf53d5b21f']::UUID[],
  ARRAY['2a27f6d4-e6a9-f2fd-d691-7de103d7c443', 'ce392c42-3858-091d-cd39-3fc69bca92c2', 'e5fd9fa5-5da1-7262-f40a-c2300888e1ad']::UUID[],
  ARRAY['49990ffa-5698-bd91-b379-6703a8cf4835', 'd8e58a90-32e7-0b43-447c-fda790891cee', '6b8684a8-cd06-6f6a-9a53-d57ad527041b', '2e3380af-e6a2-6080-ceee-1c91b65121c4']::UUID[],
  false,
  true,
  3,
  0.65, 
  0.5
);

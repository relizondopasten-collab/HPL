-- =============================================================
-- Datos iniciales: plagas comunes en tomate y cultivos típicos.
-- =============================================================

insert into crops (scientific_name, common_name, variety) values
  ('Solanum lycopersicum', 'Tomate', null),
  ('Capsicum annuum',      'Pimiento', null),
  ('Cucumis sativus',      'Pepino', null)
on conflict do nothing;

insert into pests (scientific_name, common_name, category, stages, default_unit, protocol_ref) values
  ('Tuta absoluta',           'Polilla del tomate',          'lepidoptera',
     array['egg','larva_n1','larva_n2','larva_n3','larva_n4','adult']::life_stage[],
     'larvas/planta',          'EPPO PP 1/281'),
  ('Trialeurodes vaporariorum','Mosquita blanca de invernadero','hemiptera',
     array['egg','nymph','adult']::life_stage[],
     'ninfas/cm² foliar',       'EPPO PP 1/36'),
  ('Bemisia tabaci',          'Mosca blanca del tabaco',     'hemiptera',
     array['egg','nymph','adult']::life_stage[],
     'ninfas/cm² foliar',       'EPPO PP 1/35'),
  ('Frankliniella occidentalis','Trips occidental',          'thysanoptera',
     array['nymph','adult']::life_stage[],
     'trips/flor',              'EPPO PP 1/65'),
  ('Tetranychus urticae',     'Arañita bimaculada',          'acari',
     array['egg','mobile_form','adult']::life_stage[],
     'móviles/hoja',            'EPPO PP 1/199'),
  ('Leveillula taurica',      'Oídio (Leveillula)',          'disease_aerial',
     '{}'::life_stage[],
     '% severidad foliar',      'EPPO PP 1/154'),
  ('Oidium neolycopersici',   'Oídio del tomate',            'disease_aerial',
     '{}'::life_stage[],
     '% severidad foliar',      'EPPO PP 1/154'),
  ('Botrytis cinerea',        'Moho gris',                   'disease_aerial',
     '{}'::life_stage[],
     '% severidad / incidencia','EPPO PP 1/17'),
  ('Fusarium oxysporum f.sp. radicis-lycopersici', 'Fusarium de la corona', 'disease_soil',
     '{}'::life_stage[],
     '% plantas afectadas',      null),
  ('Verticillium dahliae',    'Verticilosis',                'disease_soil',
     '{}'::life_stage[],
     '% plantas afectadas',      null),
  ('Meloidogyne incognita',   'Nematodo agallador',          'nematode',
     '{}'::life_stage[],
     'escala 0-10 Bridge & Page','Bridge & Page 1980')
on conflict (scientific_name) do nothing;

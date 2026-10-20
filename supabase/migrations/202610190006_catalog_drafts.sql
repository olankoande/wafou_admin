-- Initial editable drafts only; no tariff, fee rate or publication.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('wafou.billing.configuration',0));
INSERT INTO public.services(slug,name_fr,name_en,description_fr,description_en) VALUES('home-cleaning','Ménage à domicile','Home cleaning','Ménage composé par type, pièces et options.','Cleaning composed by type, rooms and extras.') ON CONFLICT(slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en,unit,sort_order)
SELECT s.id,v.kind,v.slug,v.fr,v.en,v.fr,v.en,v.unit,v.ord FROM public.services s CROSS JOIN (VALUES
('cleaning_type','regular','Ménage courant','Regular cleaning',NULL,0),
('cleaning_type','deep','Grand ménage','Deep cleaning',NULL,1),
('cleaning_type','move','Entrée / sortie de logement','Move-in / move-out cleaning',NULL,2),
('cleaning_type','event','Après événement','After-event cleaning',NULL,3),
('frequency','once','Ponctuel','One-time',NULL,4),
('frequency','weekly','Hebdomadaire','Weekly',NULL,5),
('frequency','fortnightly','Toutes les deux semaines','Every two weeks',NULL,6),
('frequency','monthly','Mensuel','Monthly',NULL,7),
('room','living-room','Salon / séjour','Living room','item',8),
('room','bedroom','Chambre','Bedroom','item',9),
('room','kitchen','Cuisine','Kitchen','item',10),
('room','bathroom','Salle de bain','Bathroom','item',11),
('room','toilet','Toilettes séparées','Separate toilet','item',12),
('room','dining-room','Salle à manger','Dining room','item',13),
('room','office','Bureau','Home office','item',14),
('room','hallway','Entrée / couloir','Entrance / hallway',NULL,15),
('room','stairs','Escalier','Stairs','flight',16),
('room','laundry-room','Buanderie','Laundry room','item',17),
('option','oven','Intérieur du four','Inside oven','item',18),
('option','fridge','Intérieur du réfrigérateur','Inside refrigerator','item',19),
('option','cupboards','Intérieur des placards','Inside cupboards',NULL,20),
('option','hood','Dégraissage de hotte','Extractor hood degreasing','item',21),
('option','windows','Vitres intérieures','Interior windows','window',22),
('option','linen','Changement des draps','Change bed linen','bed',23),
('option','washing','Lavage et séchage du linge','Laundry washing and drying','load',24),
('option','folding','Pliage du linge','Fold laundry',NULL,25),
('option','ironing','Repassage','Ironing','hour',26),
('option','dishes','Vaisselle à la main','Hand washing dishes',NULL,27),
('option','baseboards','Plinthes et portes en profondeur','Detailed baseboards and doors',NULL,28),
('option','balcony','Balcon / terrasse','Balcony / patio','m2',29),
('option','sofa','Nettoyage spécialisé du canapé','Specialist sofa cleaning','item',30),
('option','carpet','Nettoyage spécialisé du tapis','Specialist carpet cleaning','item',31),
('option','mattress','Nettoyage spécialisé du matelas','Specialist mattress cleaning','item',32),
('task','dust','Dépoussiérage des surfaces accessibles','Dust accessible surfaces',NULL,33),
('task','floors','Aspiration et lavage des sols','Vacuum and mop floors',NULL,34),
('task','make-bed','Refaire le lit sans changer les draps','Make bed without changing linen',NULL,35),
('task','kitchen-surfaces','Plans de travail, évier et plaque','Counters, sink and hob',NULL,36),
('task','appliance-exteriors','Extérieur des appareils et façades accessibles','Appliance exteriors and accessible fronts',NULL,37),
('task','bathroom-fixtures','Lavabo, douche, baignoire, miroir et robinetterie','Sink, shower, bathtub, mirror and taps',NULL,38),
('task','clean-toilet','Nettoyage des toilettes présentes','Clean toilets present',NULL,39),
('task','stair-rail','Marches et rampe accessibles','Accessible steps and handrail',NULL,40)) AS v(kind,slug,fr,en,unit,ord) WHERE s.slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-oven','Intérieur du four','Inside oven','Intérieur du four','Inside oven' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-fridge','Intérieur du réfrigérateur','Inside refrigerator','Intérieur du réfrigérateur','Inside refrigerator' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-cupboards','Intérieur des placards','Inside cupboards','Intérieur des placards','Inside cupboards' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-hood','Dégraissage de hotte','Extractor hood degreasing','Dégraissage de hotte','Extractor hood degreasing' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-windows','Vitres intérieures','Interior windows','Vitres intérieures','Interior windows' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-linen','Changement des draps','Change bed linen','Changement des draps','Change bed linen' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-washing','Lavage et séchage du linge','Laundry washing and drying','Lavage et séchage du linge','Laundry washing and drying' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-folding','Pliage du linge','Fold laundry','Pliage du linge','Fold laundry' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-ironing','Repassage','Ironing','Repassage','Ironing' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-dishes','Vaisselle à la main','Hand washing dishes','Vaisselle à la main','Hand washing dishes' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-baseboards','Plinthes et portes en profondeur','Detailed baseboards and doors','Plinthes et portes en profondeur','Detailed baseboards and doors' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-balcony','Balcon / terrasse','Balcony / patio','Balcon / terrasse','Balcony / patio' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-sofa','Nettoyage spécialisé du canapé','Specialist sofa cleaning','Nettoyage spécialisé du canapé','Specialist sofa cleaning' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-carpet','Nettoyage spécialisé du tapis','Specialist carpet cleaning','Nettoyage spécialisé du tapis','Specialist carpet cleaning' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_components(service_id,kind,slug,name_fr,name_en,description_fr,description_en) SELECT id,'task','task-mattress','Nettoyage spécialisé du matelas','Specialist mattress cleaning','Nettoyage spécialisé du matelas','Specialist mattress cleaning' FROM public.services WHERE slug='home-cleaning' ON CONFLICT(service_id,slug) DO NOTHING;
INSERT INTO public.catalog_links(service_id,parent_id,child_id,relation) SELECT s.id,p.id,c.id,'included' FROM public.services s CROSS JOIN (VALUES
('living-room','dust'),
('living-room','floors'),
('bedroom','dust'),
('bedroom','floors'),
('kitchen','dust'),
('kitchen','floors'),
('bathroom','dust'),
('bathroom','floors'),
('toilet','dust'),
('toilet','floors'),
('dining-room','dust'),
('dining-room','floors'),
('office','dust'),
('office','floors'),
('hallway','dust'),
('hallway','floors'),
('stairs','stair-rail'),
('laundry-room','dust'),
('laundry-room','floors'),
('bedroom','make-bed'),
('kitchen','kitchen-surfaces'),
('kitchen','appliance-exteriors'),
('bathroom','bathroom-fixtures'),
('bathroom','clean-toilet'),
('toilet','clean-toilet'),
('laundry-room','appliance-exteriors'),
('oven','task-oven'),
('fridge','task-fridge'),
('cupboards','task-cupboards'),
('hood','task-hood'),
('windows','task-windows'),
('linen','task-linen'),
('washing','task-washing'),
('folding','task-folding'),
('ironing','task-ironing'),
('dishes','task-dishes'),
('baseboards','task-baseboards'),
('balcony','task-balcony'),
('sofa','task-sofa'),
('carpet','task-carpet'),
('mattress','task-mattress')) v(parent,child) JOIN public.catalog_components p ON p.slug=v.parent JOIN public.catalog_components c ON c.slug=v.child AND c.service_id=p.service_id WHERE s.slug='home-cleaning' AND p.service_id=s.id ON CONFLICT DO NOTHING;
INSERT INTO public.configuration_revisions(resource,record_id,record_version,reason,after_data) SELECT 'catalog_components',id,version,'Initialisation en brouillon du catalogue accepté',to_jsonb(c) FROM public.catalog_components c WHERE service_id=(SELECT id FROM public.services WHERE slug='home-cleaning');
INSERT INTO wafou_private.schema_migrations(version,description) VALUES('202610190006','Initial bilingual cleaning catalog drafts; no commercial prices or fees');
COMMIT;

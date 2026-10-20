-- Prepare editable shop drafts from the existing accepted catalogue, without altering it.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('wafou.billing.configuration',0));
CREATE TEMP TABLE wafou_new_shop_drafts ON COMMIT DROP AS
WITH added AS (
 INSERT INTO public.services(slug,name_fr,name_en,description_fr,description_en,status,shop_enabled,icon_key,unit,min_quantity,max_quantity,quantity_step,sort_order,included_fr,included_en)
 SELECT 'shop-'||c.slug,
  CASE WHEN c.kind='room' THEN 'Nettoyage — '||c.name_fr ELSE c.name_fr END,
  CASE WHEN c.kind='room' THEN c.name_en||' cleaning' ELSE c.name_en END,
  c.description_fr,c.description_en,'draft',true,
  CASE c.slug WHEN 'living-room' THEN 'sofa' WHEN 'bedroom' THEN 'bed' WHEN 'kitchen' THEN 'kitchen' WHEN 'bathroom' THEN 'bathroom'
   WHEN 'toilet' THEN 'toilet' WHEN 'office' THEN 'office' WHEN 'stairs' THEN 'stairs' WHEN 'laundry-room' THEN 'laundry'
   WHEN 'oven' THEN 'oven' WHEN 'fridge' THEN 'fridge' WHEN 'windows' THEN 'window' WHEN 'linen' THEN 'bed'
   WHEN 'washing' THEN 'laundry' WHEN 'folding' THEN 'laundry' WHEN 'ironing' THEN 'laundry' WHEN 'dishes' THEN 'dishes'
   WHEN 'sofa' THEN 'sofa' WHEN 'mattress' THEN 'bed' ELSE 'cleaning' END,
  coalesce(c.unit,'item'),greatest(c.min_quantity,0.001),c.max_quantity,c.quantity_step,c.sort_order,
  coalesce((SELECT string_agg(t.name_fr,E'\n' ORDER BY t.slug) FROM public.catalog_links l JOIN public.catalog_components t ON t.id=l.child_id WHERE l.parent_id=c.id AND l.relation='included'),''),
  coalesce((SELECT string_agg(t.name_en,E'\n' ORDER BY t.slug) FROM public.catalog_links l JOIN public.catalog_components t ON t.id=l.child_id WHERE l.parent_id=c.id AND l.relation='included'),'')
 FROM public.catalog_components c JOIN public.services s ON s.id=c.service_id
 WHERE s.slug='home-cleaning' AND c.kind IN ('room','option')
 ON CONFLICT(slug) DO NOTHING RETURNING id,slug
)
SELECT a.id,c.id AS original_id FROM added a JOIN public.catalog_components c ON a.slug='shop-'||c.slug JOIN public.services s ON s.id=c.service_id AND s.slug='home-cleaning';

INSERT INTO public.catalog_components(service_id,slug,kind,name_fr,name_en,description_fr,description_en,status)
SELECT DISTINCT d.id,t.slug,'task',t.name_fr,t.name_en,t.description_fr,t.description_en,'draft'
FROM wafou_new_shop_drafts d JOIN public.catalog_links l ON l.parent_id=d.original_id AND l.relation='included'
JOIN public.catalog_components t ON t.id=l.child_id AND t.kind='task';
UPDATE public.services s SET included_task_ids=ARRAY(SELECT t.id FROM public.catalog_components t WHERE t.service_id=s.id AND t.kind='task' ORDER BY t.slug)
WHERE s.id IN (SELECT id FROM wafou_new_shop_drafts);
INSERT INTO public.configuration_revisions(resource,record_id,record_version,reason,after_data)
SELECT 'services',s.id,s.version,'Prepare shop draft from existing catalogue; review units, content and tasks before publication',to_jsonb(s)
FROM public.services s JOIN wafou_new_shop_drafts d ON d.id=s.id;

INSERT INTO wafou_private.schema_migrations(version,description) VALUES('202610190010','Editable individual shop drafts and copied task scope; no prices, fees or publication');
NOTIFY pgrst,'reload schema';
COMMIT;

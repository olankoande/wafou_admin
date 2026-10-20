BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('wafou.billing.configuration',0));
CREATE FUNCTION public.admin_pricing_preview(p_cart jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE service uuid; type_id uuid; freq uuid; area uuid; curr text; at_time timestamptz;
 selected uuid[]:='{}'; row_data jsonb; c public.catalog_components; rate public.catalog_rates; fee public.platform_fee_rules;
 lines jsonb:='[]'; fees jsonb:='[]'; issues jsonb:='[]'; rules jsonb:='[]'; snapshots jsonb:='[]';
 qty numeric; hours numeric; line_amount bigint; subtotal bigint:=0; fee_amount bigint; client_fee bigint:=0; provider_fee bigint:=0;
 n integer; global_count integer; payer_name text; selected_parents uuid[];
BEGIN
 IF NOT wafou_private.has_permission('catalog.read') OR NOT wafou_private.has_permission('finance.read') THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF p_cart IS NULL OR jsonb_typeof(p_cart)<>'object' OR octet_length(p_cart::text)>50000 OR
  jsonb_typeof(p_cart->'items') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_CART'; END IF;
 IF jsonb_array_length(p_cart->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_CART'; END IF;
 service:=(p_cart->>'service_id')::uuid; type_id:=(p_cart->>'cleaning_type_id')::uuid;
 freq:=(p_cart->>'frequency_id')::uuid; area:=(p_cart->>'area_id')::uuid;
 curr:=p_cart->>'currency'; at_time:=coalesce((p_cart->>'at')::timestamptz,now());
 IF service IS NULL OR type_id IS NULL OR curr IS NULL OR curr NOT IN ('CAD','USD','EUR') OR
  NOT EXISTS(SELECT 1 FROM public.services WHERE id=service) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_CART'; END IF;
 PERFORM wafou_private.billing_component(type_id,service,'cleaning_type');
 PERFORM wafou_private.billing_component(freq,service,'frequency');
 IF area IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.service_areas WHERE id=area AND active) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_AREA'; END IF;
 IF EXISTS(SELECT 1 FROM public.catalog_components WHERE id IN (type_id,freq) AND status<>'active') THEN
  issues:=issues||jsonb_build_array('INACTIVE_COMPONENT'); END IF;
 FOR row_data IN SELECT value FROM jsonb_array_elements(p_cart->'items') LOOP
  IF jsonb_typeof(row_data->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_QUANTITY'; END IF;
  SELECT * INTO c FROM public.catalog_components WHERE id=(row_data->>'component_id')::uuid AND service_id=service AND kind IN ('room','option');
  IF NOT FOUND OR c.id=ANY(selected) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_COMPONENT'; END IF;
  qty:=(row_data->>'quantity')::numeric;
  IF qty<=0 OR qty<c.min_quantity OR qty>coalesce(c.max_quantity,100000) OR mod(qty-c.min_quantity,c.quantity_step)<>0 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_QUANTITY'; END IF;
  selected:=array_append(selected,c.id); snapshots:=snapshots||jsonb_build_array(jsonb_build_object('component',to_jsonb(c),'quantity',qty));
  IF c.status<>'active' THEN issues:=issues||jsonb_build_array('INACTIVE_COMPONENT'); END IF;
 END LOOP;
 selected_parents:=array_append(selected,type_id);
 IF EXISTS(SELECT 1 FROM public.catalog_links l WHERE l.service_id=service AND l.status='active'
  AND (l.cleaning_type_id IS NULL OR l.cleaning_type_id=type_id) AND
  ((l.relation='incompatible' AND l.parent_id=ANY(selected_parents) AND l.child_id=ANY(selected_parents)) OR
   (l.relation='requires' AND l.parent_id=ANY(selected_parents) AND NOT l.child_id=ANY(selected_parents)))) THEN
  issues:=issues||jsonb_build_array('INCOMPATIBLE_SELECTION'); END IF;
 -- A charged option must not repeat a task already included elsewhere in this selection.
 IF EXISTS(SELECT 1 FROM public.catalog_links a JOIN public.catalog_links b ON a.child_id=b.child_id AND a.parent_id<>b.parent_id
  JOIN public.catalog_components opt ON opt.id=a.parent_id AND opt.kind='option'
  WHERE a.status='active' AND b.status='active' AND a.relation='included' AND b.relation='included'
  AND a.parent_id=ANY(selected) AND b.parent_id=ANY(selected_parents)
  AND (a.cleaning_type_id IS NULL OR a.cleaning_type_id=type_id) AND (b.cleaning_type_id IS NULL OR b.cleaning_type_id=type_id)) THEN
  issues:=issues||jsonb_build_array('TASK_ALREADY_INCLUDED'); END IF;
 IF EXISTS(SELECT 1 FROM public.catalog_links a JOIN public.catalog_links b ON a.child_id=b.child_id
  WHERE a.parent_id=ANY(selected_parents) AND b.parent_id=ANY(selected_parents)
   AND a.relation='included' AND b.relation='excluded' AND a.status='active' AND b.status='active'
   AND (a.cleaning_type_id IS NULL OR a.cleaning_type_id=type_id) AND (b.cleaning_type_id IS NULL OR b.cleaning_type_id=type_id)) THEN
  issues:=issues||jsonb_build_array('CONFLICTING_TASK_SCOPE'); END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('child',to_jsonb(child))),'[]') INTO rules
 FROM public.catalog_links l JOIN public.catalog_components child ON child.id=l.child_id WHERE l.service_id=service AND l.status='active'
  AND l.parent_id=ANY(selected_parents) AND (l.cleaning_type_id IS NULL OR l.cleaning_type_id=type_id);
 SELECT count(*) INTO global_count FROM public.catalog_rates WHERE service_id=service AND component_id IS NULL AND status='active' AND currency=curr
  AND (cleaning_type_id IS NULL OR cleaning_type_id=type_id) AND (frequency_id IS NULL OR frequency_id=freq) AND (area_id IS NULL OR area_id=area)
  AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
 IF global_count>1 THEN issues:=issues||jsonb_build_array('AMBIGUOUS_RATE');
 ELSIF global_count=1 THEN
  SELECT * INTO rate FROM public.catalog_rates WHERE service_id=service AND component_id IS NULL AND status='active' AND currency=curr
   AND (cleaning_type_id IS NULL OR cleaning_type_id=type_id) AND (frequency_id IS NULL OR frequency_id=freq) AND (area_id IS NULL OR area_id=area)
   AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
  IF rate.pricing_mode='quote' THEN issues:=issues||jsonb_build_array('QUOTE_REQUIRED');
  ELSIF rate.pricing_mode='hourly' THEN
   IF jsonb_typeof(p_cart->'hours') IS DISTINCT FROM 'number' THEN issues:=issues||jsonb_build_array('HOURS_REQUIRED');
   ELSE hours:=(p_cart->>'hours')::numeric;
    IF hours<=0 OR hours>100000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_HOURS'; END IF;
    subtotal:=round(rate.amount_minor*hours); END IF;
  ELSIF rate.pricing_mode='fixed' THEN subtotal:=rate.amount_minor;
  ELSE issues:=issues||jsonb_build_array('INVALID_GLOBAL_RATE'); END IF;
  lines:=lines||jsonb_build_array(jsonb_build_object('rate',to_jsonb(rate),'quantity',CASE WHEN rate.pricing_mode='hourly' THEN hours ELSE 1 END,'amount_minor',subtotal));
 END IF;
 IF global_count<=1 THEN
  FOR row_data IN SELECT value FROM jsonb_array_elements(snapshots) LOOP
   IF global_count=1 AND row_data->'component'->>'kind'='room' THEN CONTINUE; END IF;
   SELECT count(*) INTO n FROM public.catalog_rates WHERE service_id=service AND component_id=(row_data->'component'->>'id')::uuid AND status='active' AND currency=curr
    AND (cleaning_type_id IS NULL OR cleaning_type_id=type_id) AND (frequency_id IS NULL OR frequency_id=freq) AND (area_id IS NULL OR area_id=area)
    AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
   IF n<>1 THEN issues:=issues||jsonb_build_array(CASE WHEN n=0 THEN 'RATE_UNCONFIGURED' ELSE 'AMBIGUOUS_RATE' END); CONTINUE; END IF;
   SELECT * INTO rate FROM public.catalog_rates WHERE service_id=service AND component_id=(row_data->'component'->>'id')::uuid AND status='active' AND currency=curr
    AND (cleaning_type_id IS NULL OR cleaning_type_id=type_id) AND (frequency_id IS NULL OR frequency_id=freq) AND (area_id IS NULL OR area_id=area)
    AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
   IF rate.pricing_mode='quote' THEN issues:=issues||jsonb_build_array('QUOTE_REQUIRED'); CONTINUE; END IF;
   qty:=(row_data->>'quantity')::numeric; line_amount:=round(rate.amount_minor*qty); subtotal:=subtotal+line_amount;
   lines:=lines||jsonb_build_array(jsonb_build_object('rate',to_jsonb(rate),'quantity',qty,'amount_minor',line_amount));
  END LOOP;
 END IF;
 FOREACH payer_name IN ARRAY ARRAY['client','provider'] LOOP
  SELECT count(*) INTO n FROM public.platform_fee_rules WHERE status='active' AND payer=payer_name AND currency=curr
   AND (service_id IS NULL OR service_id=service) AND (cleaning_type_id IS NULL OR cleaning_type_id=type_id)
   AND (frequency_id IS NULL OR frequency_id=freq) AND (area_id IS NULL OR area_id=area)
   AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
  IF n<>1 THEN issues:=issues||jsonb_build_array(CASE WHEN n=0 THEN 'FEE_UNCONFIGURED_'||upper(payer_name) ELSE 'AMBIGUOUS_FEE' END); CONTINUE; END IF;
  SELECT * INTO fee FROM public.platform_fee_rules WHERE status='active' AND payer=payer_name AND currency=curr
   AND (service_id IS NULL OR service_id=service) AND (cleaning_type_id IS NULL OR cleaning_type_id=type_id)
   AND (frequency_id IS NULL OR frequency_id=freq) AND (area_id IS NULL OR area_id=area)
   AND (valid_from IS NULL OR valid_from<=at_time) AND (valid_until IS NULL OR valid_until>at_time);
  fee_amount:=coalesce(fee.fixed_minor,0)+round(subtotal*coalesce(fee.percentage_bps,0)::numeric/10000);
  fee_amount:=greatest(fee_amount,coalesce(fee.minimum_minor,fee_amount)); fee_amount:=least(fee_amount,coalesce(fee.maximum_minor,fee_amount));
  IF payer_name='client' THEN client_fee:=fee_amount; ELSE provider_fee:=fee_amount; END IF;
  fees:=fees||jsonb_build_array(jsonb_build_object('rule',to_jsonb(fee),'amount_minor',fee_amount));
 END LOOP;
 IF provider_fee>subtotal THEN issues:=issues||jsonb_build_array('PROVIDER_FEE_EXCEEDS_SUBTOTAL'); END IF;
 RETURN jsonb_build_object('simulation_only',true,'bookable',false,'taxes_status','unconfigured','currency',curr,
  'issues',issues,'pricing_complete',jsonb_array_length(issues)=0,
  'subtotal_minor',CASE WHEN jsonb_array_length(issues)=0 THEN subtotal END,
  'client_total_before_tax_minor',CASE WHEN jsonb_array_length(issues)=0 THEN subtotal+client_fee END,
  'provider_net_before_tax_minor',CASE WHEN jsonb_array_length(issues)=0 THEN subtotal-provider_fee END,
  'components',snapshots,'task_links',rules,'lines',lines,'fees',fees,
  'cleaning_type',(SELECT to_jsonb(t) FROM public.catalog_components t WHERE id=type_id),
  'frequency',(SELECT to_jsonb(t) FROM public.catalog_components t WHERE id=freq),
  'at',at_time,'service_id',service);
END $$;
REVOKE ALL ON FUNCTION public.admin_pricing_preview(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_pricing_preview(jsonb) TO authenticated;
INSERT INTO wafou_private.schema_migrations(version,description) VALUES('202610190005','Read-only admin pricing preview, no tax calculation or payment');
NOTIFY pgrst,'reload schema';
COMMIT;

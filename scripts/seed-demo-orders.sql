-- =============================================================================
-- Demo order history for the local demo customer (local development only).
-- Run after `npm run db:reset` and `npm run seed:users`:
--
--   docker exec -i supabase_db_deskcraft psql -U postgres -d postgres < scripts/seed-demo-orders.sql
--
-- Orders go through the same functions the app uses: create_order() reserves
-- stock at database prices, apply_checkout_event() marks them paid as if a
-- Stripe webhook had arrived (fake event ids, no Stripe call), and status
-- updates pass the lifecycle guard trigger. Safe to re-run: it does nothing if
-- the demo customer already has orders.
-- =============================================================================

create or replace function pg_temp.demo_order(p_items jsonb, p_status text, p_days_ago integer)
returns void
language plpgsql
as $$
declare
  v_email text := 'customer@deskcraft.test';
  v_user uuid;
  v_order uuid;
  v_total integer;
  v_items jsonb;
  v_ref text;
begin
  select id into v_user from auth.users where email = v_email;
  if v_user is null then
    raise exception 'Demo customer % not found. Run `npm run seed:users` first.', v_email;
  end if;

  select jsonb_agg(jsonb_build_object('product_id', p.id, 'quantity', (i.value)::int))
    into v_items
    from jsonb_each_text(p_items) i
    join public.products p on p.slug = i.key;

  v_order := public.create_order(v_user, v_email, v_items);
  select total_cents into v_total from public.orders where id = v_order;
  v_ref := replace(v_order::text, '-', '');

  if p_status = 'cancelled' then
    perform public.release_pending_order(v_order);
  elsif p_status <> 'pending' then
    perform public.apply_checkout_event(
      'evt_demo_' || v_ref, 'checkout.session.completed', v_order,
      'cs_demo_' || v_ref, 'pi_demo_' || v_ref, v_total, 'usd', 'paid');
    if p_status in ('processing', 'shipped', 'delivered') then
      update public.orders set status = 'processing' where id = v_order;
    end if;
    if p_status in ('shipped', 'delivered') then
      update public.orders set status = 'shipped' where id = v_order;
    end if;
    if p_status = 'delivered' then
      update public.orders set status = 'delivered' where id = v_order;
    end if;
  end if;

  update public.orders
    set created_at = now() - make_interval(days => p_days_ago),
        paid_at = case when paid_at is not null then now() - make_interval(days => p_days_ago) end,
        confirmation_email_sent_at = case when paid_at is not null then now() - make_interval(days => p_days_ago) end
    where id = v_order;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.orders o join auth.users u on u.id = o.user_id
    where u.email = 'customer@deskcraft.test'
  ) then
    raise notice 'Demo customer already has orders; nothing to do.';
    return;
  end if;

  perform pg_temp.demo_order('{"arc75-wireless-mechanical-keyboard": 1, "vector-pro-wireless-gaming-mouse": 1}', 'delivered', 24);
  perform pg_temp.demo_order('{"glide-ergonomic-wireless-mouse": 1}', 'cancelled', 12);
  perform pg_temp.demo_order('{"pulse-anc-wireless-headphones": 1}', 'shipped', 9);
  perform pg_temp.demo_order('{"vista-27-4k-ips-monitor": 1, "nexus-8-in-1-usb-c-hub": 1}', 'processing', 4);
  perform pg_temp.demo_order('{"echo-usb-condenser-microphone": 1, "bolt-2tb-nvme-ssd": 2}', 'paid', 1);
  perform pg_temp.demo_order('{"clarity-4k-streaming-webcam": 1}', 'pending', 0);
end;
$$;

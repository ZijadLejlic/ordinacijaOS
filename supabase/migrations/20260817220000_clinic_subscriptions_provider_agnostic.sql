-- D54/D55: provider-agnostic billing columns on clinic_subscriptions.
-- Renames Stripe-named columns. Card MoR = Lemon Squeezy (paddle reserved as
-- fallback); virman = manual. Existing public.payment_method is for *invoice*
-- payments (cash/card/bank_transfer/other) — do not reuse it here.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'billing_provider'
  ) then
    create type public.billing_provider as enum (
      'lemonsqueezy',
      'paddle',
      'manual'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'billing_payment_method'
  ) then
    create type public.billing_payment_method as enum (
      'card',
      'bank_transfer'
    );
  end if;
end $$;

alter table public.clinic_subscriptions
  rename column stripe_customer_id to provider_customer_id;

alter table public.clinic_subscriptions
  rename column stripe_subscription_id to provider_subscription_id;

alter table public.clinic_subscriptions
  add column if not exists provider public.billing_provider,
  add column if not exists provider_variant_id text,
  add column if not exists payment_method public.billing_payment_method;

-- Webhook lookups: one subscription id per provider.
create unique index if not exists clinic_subscriptions_provider_sub_uidx
  on public.clinic_subscriptions (provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;

comment on column public.clinic_subscriptions.provider is
  'MoR or manual (D54/D55). NULL until billing starts.';
comment on column public.clinic_subscriptions.provider_customer_id is
  'Provider customer id. NULL until card billing.';
comment on column public.clinic_subscriptions.provider_subscription_id is
  'Provider subscription id. NULL for virman / until billing.';
comment on column public.clinic_subscriptions.provider_variant_id is
  'Provider price/variant id; mapped to plans.id in app config (D42).';
comment on column public.clinic_subscriptions.payment_method is
  'card (MoR checkout) or bank_transfer (virman). NULL until billing.';

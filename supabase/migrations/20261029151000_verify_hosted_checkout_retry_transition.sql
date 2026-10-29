do $$
declare definition text := pg_get_functiondef('public.validate_payment_attempt()'::regprocedure);
begin
  if position('old.status = ''failed''' in definition)=0
    or position('old.payment_method_id is null' in definition)=0
    or position('invoice_checkout_requests' in definition)=0
    or position('checkout_request.status = ''open''' in definition)=0 then
    raise exception 'hosted Checkout retry transition is not narrowly bound';
  end if;
end $$;

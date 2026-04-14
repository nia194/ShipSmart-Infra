
-- Fix user_roles: add read policy for own roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Tighten shipment_requests insert: allow authenticated users to set their user_id
DROP POLICY "Anyone can insert shipment requests" ON public.shipment_requests;
CREATE POLICY "Authenticated users can insert shipment requests" ON public.shipment_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anonymous users can insert shipment requests" ON public.shipment_requests FOR INSERT WITH CHECK (user_id IS NULL);

-- Tighten quotes insert: use service role only (edge functions run as service role)
DROP POLICY "System can insert quotes" ON public.quotes;

-- Tighten redirect_tracking
DROP POLICY "Anyone can insert redirect tracking" ON public.redirect_tracking;
CREATE POLICY "Authenticated users can insert redirect tracking" ON public.redirect_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anonymous can insert redirect tracking" ON public.redirect_tracking FOR INSERT WITH CHECK (user_id IS NULL);

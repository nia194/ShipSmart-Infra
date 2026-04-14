
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create shipment_requests table
CREATE TABLE public.shipment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  drop_off_date DATE NOT NULL,
  expected_delivery_date DATE NOT NULL,
  packages JSONB NOT NULL DEFAULT '[]',
  total_weight NUMERIC NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shipment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert shipment requests" ON public.shipment_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own shipment requests" ON public.shipment_requests FOR SELECT USING (auth.uid() = user_id);

-- Create quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_request_id UUID REFERENCES public.shipment_requests(id) ON DELETE CASCADE NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('prime', 'private')),
  carrier TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  transit_days INTEGER NOT NULL,
  estimated_delivery_date TEXT,
  deliver_by_time TEXT,
  guaranteed BOOLEAN DEFAULT false,
  promo JSONB,
  ai_recommendation TEXT,
  breakdown JSONB,
  details JSONB,
  features TEXT[] DEFAULT '{}',
  is_top_pick BOOLEAN DEFAULT false,
  rank_score NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view quotes for their shipment" ON public.quotes FOR SELECT USING (true);
CREATE POLICY "System can insert quotes" ON public.quotes FOR INSERT WITH CHECK (true);

-- Create saved_options table
CREATE TABLE public.saved_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_service_id TEXT NOT NULL,
  carrier TEXT NOT NULL,
  service_name TEXT NOT NULL,
  tier TEXT NOT NULL,
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  transit_days INTEGER NOT NULL,
  estimated_delivery TEXT,
  deliver_by_time TEXT,
  guaranteed BOOLEAN DEFAULT false,
  promo JSONB,
  ai_recommendation TEXT,
  breakdown JSONB,
  details JSONB,
  features TEXT[] DEFAULT '{}',
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  drop_off_date TEXT,
  expected_delivery_date TEXT,
  package_summary TEXT,
  book_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved options" ON public.saved_options FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own saved options" ON public.saved_options FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own saved options" ON public.saved_options FOR DELETE USING (auth.uid() = user_id);

-- Create redirect_tracking table
CREATE TABLE public.redirect_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service_id TEXT NOT NULL,
  carrier TEXT NOT NULL,
  service_name TEXT NOT NULL,
  redirect_url TEXT NOT NULL,
  origin TEXT,
  destination TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.redirect_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert redirect tracking" ON public.redirect_tracking FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own redirects" ON public.redirect_tracking FOR SELECT USING (auth.uid() = user_id);

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

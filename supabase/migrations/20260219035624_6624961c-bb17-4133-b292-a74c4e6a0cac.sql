
-- Fix RLS policies: Drop RESTRICTIVE and recreate as PERMISSIVE

-- game_events
DROP POLICY IF EXISTS "Admins can delete events" ON public.game_events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.game_events;
DROP POLICY IF EXISTS "Admins can update events" ON public.game_events;
DROP POLICY IF EXISTS "Anyone can read active events" ON public.game_events;

CREATE POLICY "Admins can delete events" ON public.game_events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert events" ON public.game_events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update events" ON public.game_events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can read active events" ON public.game_events FOR SELECT TO authenticated USING (is_active = true);

-- inventory
DROP POLICY IF EXISTS "Admins can view all inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can insert own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can update own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can view own inventory" ON public.inventory;

CREATE POLICY "Users can view own inventory" ON public.inventory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inventory" ON public.inventory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory" ON public.inventory FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all inventory" ON public.inventory FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- match_history
DROP POLICY IF EXISTS "Admins can view all match history" ON public.match_history;
DROP POLICY IF EXISTS "System can insert match history" ON public.match_history;
DROP POLICY IF EXISTS "Users can view own match history" ON public.match_history;

CREATE POLICY "Users can view own match history" ON public.match_history FOR SELECT TO authenticated USING (auth.uid() = player_id);
CREATE POLICY "System can insert match history" ON public.match_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Admins can view all match history" ON public.match_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profiles
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Also need squads and squad_members tables for the existing SquadContext
CREATE TABLE IF NOT EXISTS public.squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  squad_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting',
  max_players INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view squads" ON public.squads FOR SELECT USING (true);
CREATE POLICY "Anyone can create squads" ON public.squads FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update squads" ON public.squads FOR UPDATE USING (true);

CREATE TABLE IF NOT EXISTS public.squad_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID REFERENCES public.squads(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(squad_id, user_id)
);
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view squad members" ON public.squad_members FOR SELECT USING (true);
CREATE POLICY "Anyone can join squads" ON public.squad_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can leave squads" ON public.squad_members FOR DELETE USING (true);

-- Enable realtime for squads
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_members;

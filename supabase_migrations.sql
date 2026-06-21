-- Add parent_id to thread_replies for nested/threaded comments
ALTER TABLE thread_replies
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES thread_replies(id) ON DELETE CASCADE;

-- Run this in your Supabase SQL editor to enable settings persistence
-- Dashboard → SQL Editor → New Query → paste & run

-- Add JSONB preference columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs  JSONB,
  ADD COLUMN IF NOT EXISTS privacy_settings    JSONB,
  ADD COLUMN IF NOT EXISTS crown_prefs         JSONB,
  ADD COLUMN IF NOT EXISTS preferences         JSONB,
  ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ;

-- Optional: Create feedback table for Support & Feedback screen
CREATE TABLE IF NOT EXISTS feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('bug', 'suggestion', 'question')),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for feedback table
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stylist_id       UUID REFERENCES stylists(id) ON DELETE SET NULL,
  service_name     TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'upcoming'
                     CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id);

-- Reviews table
-- One review per booking (enforced by UNIQUE on booking_id).
-- Clients can insert their own review; nobody can update or delete reviews.
CREATE TABLE IF NOT EXISTS reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE NOT NULL,
  client_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stylist_id   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text         TEXT,
  service_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can read reviews
CREATE POLICY "Reviews are publicly readable"
  ON reviews FOR SELECT
  USING (true);

-- Only the client who made the booking can insert a review
CREATE POLICY "Clients can submit their own review"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- No UPDATE or DELETE policies — reviews are immutable once submitted.
-- Service providers cannot alter client reviews.

-- RPC that safely recalculates a stylist's aggregate rating.
-- SECURITY DEFINER so it can bypass RLS when writing back to profiles.
CREATE OR REPLACE FUNCTION recalculate_stylist_rating(p_stylist_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET
    rating       = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews WHERE stylist_id = p_stylist_id
    ), 0),
    review_count = COALESCE((
      SELECT COUNT(*) FROM reviews WHERE stylist_id = p_stylist_id
    ), 0)
  WHERE id = p_stylist_id;
END;
$$;

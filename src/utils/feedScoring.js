// Engagement: likes + weighted comments, soft-capped at 10 interactions → [0,1]
// Cap is low so that even a few likes meaningfully lifts a post above zero-engagement content.
function engagementScore(post) {
  const likes = post.likes?.[0]?.count ?? 0;
  const comments = post.comments?.[0]?.count ?? 0;
  return Math.min((likes + comments * 1.5) / 10, 1);
}

// Recency: linear decay over 60 days → [0,1]
// 60-day window keeps older high-engagement posts competitive.
function recencyScore(post) {
  const ageDays = (Date.now() - new Date(post.created_at).getTime()) / 86400000;
  return Math.max(0, 1 - ageDays / 60);
}

// Location: 1 if post author is in the same state as the viewer, else 0
// Expects "City, ST" format for both values
function locationScore(post, userLocation) {
  if (!userLocation) return 0;
  const userState = userLocation.split(', ').at(-1);
  const postState = (post.profiles?.location ?? '').split(', ').at(-1);
  return postState && userState && postState === userState ? 1 : 0;
}

// Hair type match against post.hair_type_tags (Layer 2 — requires DB migration).
// Returns null when the signal is unavailable, triggering weight redistribution.
function hairTypeScore(post, userHairProfile) {
  if (!userHairProfile?.hair_type || !post.hair_type_tags?.length) return null;
  return post.hair_type_tags.includes(userHairProfile.hair_type) ? 1 : 0;
}

// Score a post 0–100 using the 4-signal algorithm.
// When hair type data is unavailable the 40% hair weight is redistributed
// proportionally across engagement (→41.67%), recency (→33.33%), location (→25%).
export function scorePost(post, userHairProfile, userLocation) {
  const hairMatch = hairTypeScore(post, userHairProfile);
  const engagement = engagementScore(post);
  const recency = recencyScore(post);
  const location = locationScore(post, userLocation);

  if (hairMatch !== null) {
    return hairMatch * 40 + engagement * 25 + recency * 20 + location * 15;
  }
  return engagement * 41.67 + recency * 33.33 + location * 25;
}

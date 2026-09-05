export type BookStatus = "to_read" | "reading" | "finished" | "wishlist";
export type BookFormat = "physical" | "ebook" | "physical+ebook";
export type CoverType = "hardcover" | "softcover";
export type SeriesPosition =
  | "starter"
  | "next_in_series"
  | "read_prior_first"
  | "standalone";
export type Genre =
  | "Fantasy"
  | "Science Fiction"
  | "Horror"
  | "Thriller/Mystery/Crime"
  | "Historical/Literary Fiction"
  | "Nonfiction";
export type LengthCategory = "Quick" | "Medium" | "Long" | "Epic";

export const GENRES: Genre[] = [
  "Fantasy",
  "Science Fiction",
  "Horror",
  "Thriller/Mystery/Crime",
  "Historical/Literary Fiction",
  "Nonfiction",
];

export const STATUSES: BookStatus[] = ["to_read", "reading", "finished", "wishlist"];

export const FORMATS: BookFormat[] = ["physical", "ebook", "physical+ebook"];

export const COVER_TYPES: CoverType[] = ["hardcover", "softcover"];

export const SERIES_POSITIONS: SeriesPosition[] = [
  "starter",
  "next_in_series",
  "read_prior_first",
  "standalone",
];

export const WORLDS = [
  "Warhammer 40,000",
  "Warhammer: Age of Sigmar",
  "Forgotten Realms",
  "Dragonlance",
  "Eberron",
  "Star Wars",
  "The Witcher",
  "Warcraft",
  "Diablo",
] as const;

export const MOODS = [
  "🌑 Dark & Heavy",
  "⚔️ War & Military",
  "🧩 Dense & Complex",
  "👻 Horror & Creepy",
  "🕵️ Mystery & Investigation",
  "♟️ Political Intrigue",
  "🌌 Weird & Strange",
  "❤️ Character-Driven & Emotional",
  "🫂 Found Family & Camaraderie",
  "🗺️ Adventure & Exploration",
  "😄 Humor & Wit",
  "💨 Fast-Paced & Action",
  "💘 Romance",
  "🧠 Big Ideas & Philosophical",
] as const;

export interface Book {
  trello_id: string;
  title: string;
  author: string | null;
  genre: Genre | null;
  series: string | null;
  series_index: number | null;
  series_position: SeriesPosition | null;
  pages: number | null;
  length_category: LengthCategory | null;
  status: BookStatus;
  owned: boolean;
  format: BookFormat | null;
  cover_type: CoverType | null;
  special_edition: boolean;
  my_rating: number | null;
  moods: string[];
  worlds: string[];
  priority: boolean;
  date_added: string | null;
  date_started: string | null;
  date_finished: string | null;
  description: string | null;
  cover_url: string | null;
  isbn: string | null;
  enrichment_status: "matched" | "low_confidence" | "not_found" | "error" | null;
  enrichment_checked_at: string | null;
  board_pos: number;
  created_at: string;
  updated_at: string;
}

export type BookInput = Partial<
  Omit<Book, "trello_id" | "created_at" | "updated_at" | "length_category">
> & { title: string };

export function isIncomplete(b: Book): boolean {
  return b.genre === null || b.pages === null;
}

export interface UpcomingRelease {
  google_id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  published_date: string | null;
  description: string | null;
  cover_url: string | null;
  genre_guess: string | null;
  world_guess: string | null;
  is_black_library: boolean;
  matched_watch: boolean;
  source: string;
  dismissed: boolean;
  added_to_wishlist: boolean;
  first_seen_at: string;
  last_seen_at: string;
}

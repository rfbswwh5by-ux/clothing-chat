export type ClosetItem = {
  id: string;
  name: string;
  category: string;
  color: string;
  brand?: string;
  material?: string;
  fit?: string;
  season?: string;
  notes?: string;
  image?: string;
  addedAt: string;
};

export type WeatherInfo = {
  temperature: number;
  feelsLike: number;
  description: string;
  precipitation: number;
  windSpeed: number;
  city?: string;
  units: "fahrenheit" | "celsius";
};

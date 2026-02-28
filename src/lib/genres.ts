export interface Genre {
  id: string;
  name: string;
  scenes: string[];
}

export const GENRES: Genre[] = [
  {
    id: "noir",
    name: "Noir",
    scenes: [
      "https://pocge3esja6nk0zk.public.blob.vercel-storage.com/BF0LFr1_xVCIhqE2wiNQq_CweiVRCC-cRjLFz1yMmeqKO7HvhGw5Rs3aPsdjq.png",
    ],
  },
];

export function getGenreById(id: string): Genre | undefined {
  return GENRES.find((g) => g.id === id);
}

export type Endorsement = {
  id: string;
  rav_name: string;
  rav_title: string | null;
  image_url: string | null;
  endorsement_text: string | null;
  sort_order: number;
  is_published: boolean;
};

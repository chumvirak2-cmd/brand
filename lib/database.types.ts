export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type RowBase = { id: string; user_id: string; created_at: string; updated_at: string; extra_data: Json };
type InsertBase = { id?: string; user_id?: string; created_at?: string; updated_at?: string; extra_data?: Json };
type UpdateBase = Partial<InsertBase>;

type Generic = { Row: RowBase & Record<string, unknown>; Insert: InsertBase & Record<string, unknown>; Update: UpdateBase & Record<string, unknown>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      products: Generic & {
        Row: RowBase & { name: string; sku: string; category: string; quantity: number; unit_price: number; supplier: string };
        Insert: InsertBase & { name: string; sku: string; category: string; quantity?: number; unit_price?: number; supplier?: string };
        Update: UpdateBase & { name?: string; sku?: string; category?: string; quantity?: number; unit_price?: number; supplier?: string };
      };
      materials: Generic;
      assets: Generic;
      project_sites: Generic;
      requests: Generic;
      material_movements: Generic;
      asset_movements: Generic;
      check_schedule: Generic;
      verification_matrix: Generic;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

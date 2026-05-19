export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      claims: {
        Row: {
          created_at: string
          id: string
          item_id: string
          message: string
          status: Database["public"]["Enums"]["claim_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          message: string
          status?: Database["public"]["Enums"]["claim_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          message?: string
          status?: Database["public"]["Enums"]["claim_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          created_at: string
          description: string
          id: string
          image_url: string | null
          status: Database["public"]["Enums"]["item_status"]
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_items: {
  Row: {
    id: string;
    contact_info: string | null;
    user_id: string;
    description: string;
    category: "electronics" | "clothes" | "books" | "accessories" | "bags" | "keys" | "stationery" | "other";
    image_url: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    contact_info: string | null;
    user_id: string;
    description: string;
    category: "electronics" | "clothes" | "books" | "accessories" | "bags" | "keys" | "stationery" | "other";
    image_url?: string | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    contact_info: string | null;
    user_id?: string;
    description?: string;
    category?: "electronics" | "clothes" | "books" | "accessories" | "bags" | "keys" | "stationery" | "other";
    image_url?: string | null;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "lost_items_user_id_fkey";
      columns: ["user_id"];
      isOneToOne: false;
      referencedRelation: "profiles";
      referencedColumns: ["id"];
    }
  ];
};
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          item_id: string | null
          message: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          item_id?: string | null
          message: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          item_id?: string | null
          message?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          matric_number: string | null
          id: string
          role: Database["public"]["Enums"]["profile_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          matric_number?: string | null;
          role?: Database["public"]["Enums"]["profile_role"]
        }
        Update: {
          created_at?: string
          email?: string
          matric_number?: string | null;
          id?: string
          role?: Database["public"]["Enums"]["profile_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      email_is_registered: { Args: { check_email: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      claim_status: "pending" | "resolved" | "rejected"
      item_category:
        | "electronics"
        | "clothes"
        | "books"
        | "accessories"
        | "bags"
        | "keys"
        | "stationery"
        | "other"
      item_status: "pending" | "approved" | "returned" | "rejected"
      profile_role: "admin" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      claim_status: ["pending", "resolved", "rejected"],
      item_category: [
        "electronics",
        "clothes",
        "books",
        "accessories",
        "bags",
        "keys",
        "stationery",
        "other",
      ],
      item_status: ["pending", "approved", "returned", "rejected"],
      profile_role: ["admin", "student"],
    },
  },
} as const
// Convenience aliases — add at the bottom of database.types.ts
// Convenience aliases
export type Item         = Tables<"items">
export type ItemStatus   = Enums<"item_status">
export type ItemCategory = Enums<"item_category">
export type ProfileRole  = Enums<"profile_role">
export type Notification = Tables<"notifications">
export type Claim        = Tables<"claims">
export type Profile      = Tables<"profiles">
export type ClaimStatus  = Enums<"claim_status">

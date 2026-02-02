export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string
          phone: string
          location: string
          summary: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email: string
          phone?: string
          location?: string
          summary?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string
          phone?: string
          location?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          profile_id: string
          name: string
          type: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          name: string
          type: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          name?: string
          type?: string
          content?: string
        }
        Relationships: []
      }
      cover_letters: {
        Row: {
          id: string
          profile_id: string
          job_title: string
          company_name: string
          job_description: string
          content: string
          executive_summary: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          job_title: string
          company_name?: string
          job_description: string
          content: string
          executive_summary?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          job_title?: string
          company_name?: string
          job_description?: string
          content?: string
          executive_summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      interview_results: {
        Row: {
          id: string
          profile_id: string
          call_id: string
          phone_number: string
          status: string
          transcript: string | null
          summary: string | null
          insights: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          call_id: string
          phone_number: string
          status: string
          transcript?: string | null
          summary?: string | null
          insights?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          call_id?: string
          phone_number?: string
          status?: string
          transcript?: string | null
          summary?: string | null
          insights?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      interview_guides: {
        Row: {
          id: string
          profile_id: string
          guide: Json
          documents_hash: string
          status: string
          error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          guide: Json
          documents_hash: string
          status: string
          error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          guide?: Json
          documents_hash?: string
          status?: string
          error?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

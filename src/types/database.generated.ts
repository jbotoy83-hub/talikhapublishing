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
      announcements: {
        Row: {
          action_href: string
          action_label: string
          category: string
          created_at: string
          created_by: string | null
          delay_seconds: number
          dismissible: boolean
          display_trigger: string
          enabled: boolean
          ends_at: string | null
          frequency: string
          id: string
          message: string
          presentation: string
          starts_at: string | null
          target: string
          updated_at: string
        }
        Insert: {
          action_href?: string
          action_label?: string
          category?: string
          created_at?: string
          created_by?: string | null
          delay_seconds?: number
          dismissible?: boolean
          display_trigger?: string
          enabled?: boolean
          ends_at?: string | null
          frequency?: string
          id?: string
          message?: string
          presentation?: string
          starts_at?: string | null
          target?: string
          updated_at?: string
        }
        Update: {
          action_href?: string
          action_label?: string
          category?: string
          created_at?: string
          created_by?: string | null
          delay_seconds?: number
          dismissible?: boolean
          display_trigger?: string
          enabled?: boolean
          ends_at?: string | null
          frequency?: string
          id?: string
          message?: string
          presentation?: string
          starts_at?: string | null
          target?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id: string
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          id?: never
        }
        Relationships: []
      }
      author_requests: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          due_at: string | null
          id: string
          request_type: string
          responded_at: string | null
          response: string | null
          response_choice: string | null
          status: string
          submission_id: string
          title: string
          updated_at: string
          visible_to_author: boolean
          workflow_event_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          due_at?: string | null
          id?: string
          request_type: string
          responded_at?: string | null
          response?: string | null
          response_choice?: string | null
          status?: string
          submission_id: string
          title: string
          updated_at?: string
          visible_to_author?: boolean
          workflow_event_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          due_at?: string | null
          id?: string
          request_type?: string
          responded_at?: string | null
          response?: string | null
          response_choice?: string | null
          status?: string
          submission_id?: string
          title?: string
          updated_at?: string
          visible_to_author?: boolean
          workflow_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "author_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "author_requests_workflow_event_id_fkey"
            columns: ["workflow_event_id"]
            isOneToOne: false
            referencedRelation: "workflow_events"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          affiliation: string | null
          bio: string
          created_at: string
          credentials: string | null
          id: string
          image_url: string | null
          legacy_url: string | null
          name: string
          orcid: string | null
          portrait_media_id: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          affiliation?: string | null
          bio?: string
          created_at?: string
          credentials?: string | null
          id?: string
          image_url?: string | null
          legacy_url?: string | null
          name: string
          orcid?: string | null
          portrait_media_id?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          affiliation?: string | null
          bio?: string
          created_at?: string
          credentials?: string | null
          id?: string
          image_url?: string | null
          legacy_url?: string | null
          name?: string
          orcid?: string | null
          portrait_media_id?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authors_portrait_media_id_fkey"
            columns: ["portrait_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_access_links: {
        Row: {
          certificate_record_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          output_version_id: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          certificate_record_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          output_version_id?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          certificate_record_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          output_version_id?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_access_links_certificate_record_id_fkey"
            columns: ["certificate_record_id"]
            isOneToOne: false
            referencedRelation: "certificate_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_access_links_output_version_id_fkey"
            columns: ["output_version_id"]
            isOneToOne: false
            referencedRelation: "certificate_output_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_fonts: {
        Row: {
          active: boolean
          created_at: string
          embedding_allowed: boolean
          family: string
          id: string
          license_note: string
          storage_bucket: string
          storage_path: string
          style: string
          uploaded_by: string | null
          weight: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          embedding_allowed?: boolean
          family: string
          id?: string
          license_note?: string
          storage_bucket?: string
          storage_path: string
          style?: string
          uploaded_by?: string | null
          weight?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          embedding_allowed?: boolean
          family?: string
          id?: string
          license_note?: string
          storage_bucket?: string
          storage_path?: string
          style?: string
          uploaded_by?: string | null
          weight?: number
        }
        Relationships: []
      }
      certificate_output_versions: {
        Row: {
          certificate_record_id: string
          created_at: string
          created_by: string | null
          field_values: Json
          file_hash: string | null
          id: string
          layout_overrides: Json
          pdf_path: string | null
          preview_path: string | null
          version_number: number
        }
        Insert: {
          certificate_record_id: string
          created_at?: string
          created_by?: string | null
          field_values: Json
          file_hash?: string | null
          id?: string
          layout_overrides: Json
          pdf_path?: string | null
          preview_path?: string | null
          version_number: number
        }
        Update: {
          certificate_record_id?: string
          created_at?: string
          created_by?: string | null
          field_values?: Json
          file_hash?: string | null
          id?: string
          layout_overrides?: Json
          pdf_path?: string | null
          preview_path?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificate_output_versions_certificate_record_id_fkey"
            columns: ["certificate_record_id"]
            isOneToOne: false
            referencedRelation: "certificate_records"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_records: {
        Row: {
          author_id: string | null
          certificate_number: string
          created_at: string
          field_values: Json
          id: string
          issued_at: string | null
          issued_by: string | null
          layout_overrides: Json
          publication_id: string
          reference_number: string
          status: string
          submission_id: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          certificate_number: string
          created_at?: string
          field_values?: Json
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          layout_overrides?: Json
          publication_id: string
          reference_number: string
          status?: string
          submission_id?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          certificate_number?: string
          created_at?: string
          field_values?: Json
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          layout_overrides?: Json
          publication_id?: string
          reference_number?: string
          status?: string
          submission_id?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_records_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_records_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_records_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_records_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_template_fields: {
        Row: {
          default_value: string | null
          field_key: string
          field_type: string
          id: string
          label: string
          required: boolean
          section: string
          source_key: string | null
          template_id: string
          validation_rule: Json
        }
        Insert: {
          default_value?: string | null
          field_key: string
          field_type?: string
          id?: string
          label: string
          required?: boolean
          section?: string
          source_key?: string | null
          template_id: string
          validation_rule?: Json
        }
        Update: {
          default_value?: string | null
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          required?: boolean
          section?: string
          source_key?: string | null
          template_id?: string
          validation_rule?: Json
        }
        Relationships: [
          {
            foreignKeyName: "certificate_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_template_pages: {
        Row: {
          background_bucket: string | null
          background_mime_type: string | null
          background_original_name: string | null
          background_path: string | null
          height: number
          id: string
          page_number: number
          page_type: string
          template_id: string
          width: number
        }
        Insert: {
          background_bucket?: string | null
          background_mime_type?: string | null
          background_original_name?: string | null
          background_path?: string | null
          height?: number
          id?: string
          page_number: number
          page_type?: string
          template_id: string
          width?: number
        }
        Update: {
          background_bucket?: string | null
          background_mime_type?: string | null
          background_original_name?: string | null
          background_path?: string | null
          height?: number
          id?: string
          page_number?: number
          page_type?: string
          template_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificate_template_pages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          background_bucket: string
          background_path: string | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          page_count: number
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          background_bucket?: string
          background_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          page_count?: number
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          background_bucket?: string
          background_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          page_count?: number
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      certificate_text_blocks: {
        Row: {
          asset_bucket: string | null
          asset_path: string | null
          block_type: string
          content: Json
          created_at: string
          height: number
          id: string
          locked: boolean
          overflow_behavior: string
          page_id: string
          rotation: number
          style: Json
          updated_at: string
          width: number
          x: number
          y: number
          z_index: number
        }
        Insert: {
          asset_bucket?: string | null
          asset_path?: string | null
          block_type?: string
          content?: Json
          created_at?: string
          height?: number
          id?: string
          locked?: boolean
          overflow_behavior?: string
          page_id: string
          rotation?: number
          style?: Json
          updated_at?: string
          width?: number
          x?: number
          y?: number
          z_index?: number
        }
        Update: {
          asset_bucket?: string | null
          asset_path?: string | null
          block_type?: string
          content?: Json
          created_at?: string
          height?: number
          id?: string
          locked?: boolean
          overflow_behavior?: string
          page_id?: string
          rotation?: number
          style?: Json
          updated_at?: string
          width?: number
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificate_text_blocks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "certificate_template_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      email_attachments: {
        Row: {
          created_at: string
          filename: string
          gmail_message_id: string
          id: string
          message_id: string
          mime_type: string
          provider_attachment_id: string
          size_bytes: number
        }
        Insert: {
          created_at?: string
          filename: string
          gmail_message_id: string
          id?: string
          message_id: string
          mime_type: string
          provider_attachment_id: string
          size_bytes?: number
        }
        Update: {
          created_at?: string
          filename?: string
          gmail_message_id?: string
          id?: string
          message_id?: string
          mime_type?: string
          provider_attachment_id?: string
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          actor_id: string | null
          attempt_count: number
          body_html: string
          body_text: string
          created_at: string
          direction: string
          gmail_history_id: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          provider_error: string | null
          received_at: string | null
          recipients: Json
          retryable: boolean
          rfc_message_id: string | null
          sender_email: string
          sender_name: string | null
          sent_at: string | null
          source: string
          status: string
          subject: string
          submission_id: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          attempt_count?: number
          body_html?: string
          body_text?: string
          created_at?: string
          direction: string
          gmail_history_id?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          provider_error?: string | null
          received_at?: string | null
          recipients?: Json
          retryable?: boolean
          rfc_message_id?: string | null
          sender_email: string
          sender_name?: string | null
          sent_at?: string | null
          source: string
          status: string
          subject: string
          submission_id?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          attempt_count?: number
          body_html?: string
          body_text?: string
          created_at?: string
          direction?: string
          gmail_history_id?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          provider_error?: string | null
          received_at?: string | null
          recipients?: Json
          retryable?: boolean
          rfc_message_id?: string | null
          sender_email?: string
          sender_name?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          subject?: string
          submission_id?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          created_at: string
          gmail_thread_id: string | null
          id: string
          last_message_at: string
          needs_attention: boolean
          participant_email: string | null
          participant_name: string | null
          snippet: string
          source: string
          starred: boolean
          subject: string
          submission_id: string | null
          unread: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          gmail_thread_id?: string | null
          id?: string
          last_message_at?: string
          needs_attention?: boolean
          participant_email?: string | null
          participant_name?: string | null
          snippet?: string
          source?: string
          starred?: boolean
          subject: string
          submission_id?: string | null
          unread?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          gmail_thread_id?: string | null
          id?: string
          last_message_at?: string
          needs_attention?: boolean
          participant_email?: string | null
          participant_name?: string | null
          snippet?: string
          source?: string
          starred?: boolean
          subject?: string
          submission_id?: string | null
          unread?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_sync_state: {
        Row: {
          account_email: string
          backfill_complete: boolean
          backfill_page_token: string | null
          created_at: string
          history_id: string | null
          imported_threads: number
          last_error: string | null
          last_synced_at: string | null
          phase: string
          updated_at: string
          watch_expiration: string | null
        }
        Insert: {
          account_email: string
          backfill_complete?: boolean
          backfill_page_token?: string | null
          created_at?: string
          history_id?: string | null
          imported_threads?: number
          last_error?: string | null
          last_synced_at?: string | null
          phase?: string
          updated_at?: string
          watch_expiration?: string | null
        }
        Update: {
          account_email?: string
          backfill_complete?: boolean
          backfill_page_token?: string | null
          created_at?: string
          history_id?: string | null
          imported_threads?: number
          last_error?: string | null
          last_synced_at?: string | null
          phase?: string
          updated_at?: string
          watch_expiration?: string | null
        }
        Relationships: []
      }
      issues: {
        Row: {
          cover_image_url: string | null
          cover_media_id: string | null
          created_at: string
          description: string
          editorial_metadata: Json
          id: string
          issue_number: string
          journal_id: string
          publication_date: string | null
          slug: string
          sort_order: number
          status: string
          title: string | null
          updated_at: string
          volume: string
        }
        Insert: {
          cover_image_url?: string | null
          cover_media_id?: string | null
          created_at?: string
          description?: string
          editorial_metadata?: Json
          id?: string
          issue_number: string
          journal_id: string
          publication_date?: string | null
          slug: string
          sort_order?: number
          status?: string
          title?: string | null
          updated_at?: string
          volume: string
        }
        Update: {
          cover_image_url?: string | null
          cover_media_id?: string | null
          created_at?: string
          description?: string
          editorial_metadata?: Json
          id?: string
          issue_number?: string
          journal_id?: string
          publication_date?: string | null
          slug?: string
          sort_order?: number
          status?: string
          title?: string | null
          updated_at?: string
          volume?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          accent: string
          created_at: string
          current_issue_id: string | null
          description: string
          editorial_metadata: Json
          hero_image_url: string | null
          hero_media_id: string | null
          id: string
          issn: string | null
          issn_online: string | null
          issn_print: string | null
          scope: string
          slug: string
          status: string
          submission_issue_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accent?: string
          created_at?: string
          current_issue_id?: string | null
          description?: string
          editorial_metadata?: Json
          hero_image_url?: string | null
          hero_media_id?: string | null
          id?: string
          issn?: string | null
          issn_online?: string | null
          issn_print?: string | null
          scope?: string
          slug: string
          status?: string
          submission_issue_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accent?: string
          created_at?: string
          current_issue_id?: string | null
          description?: string
          editorial_metadata?: Json
          hero_image_url?: string | null
          hero_media_id?: string | null
          id?: string
          issn?: string | null
          issn_online?: string | null
          issn_print?: string | null
          scope?: string
          slug?: string
          status?: string
          submission_issue_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journals_current_issue_id_fkey"
            columns: ["current_issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_hero_media_id_fkey"
            columns: ["hero_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_submission_issue_id_fkey"
            columns: ["submission_issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string
          created_at: string
          created_by: string | null
          credit: string | null
          height: number | null
          id: string
          mime_type: string
          original_name: string
          public_url: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          width: number | null
        }
        Insert: {
          alt_text?: string
          created_at?: string
          created_by?: string | null
          credit?: string | null
          height?: number | null
          id?: string
          mime_type: string
          original_name: string
          public_url: string
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          width?: number | null
        }
        Update: {
          alt_text?: string
          created_at?: string
          created_by?: string | null
          credit?: string | null
          height?: number | null
          id?: string
          mime_type?: string
          original_name?: string
          public_url?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: []
      }
      media_placements: {
        Row: {
          asset_id: string
          created_at: string
          crop: Json
          entity_id: string
          entity_type: string
          id: string
          placement_key: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          crop?: Json
          entity_id: string
          entity_type: string
          id?: string
          placement_key: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          crop?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          placement_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_placements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          consent_at: string
          created_at: string
          email: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          consent_at?: string
          created_at?: string
          email: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          consent_at?: string
          created_at?: string
          email?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          metadata: Json
          recipient_email: string | null
          recipient_type: string
          recipient_user_id: string | null
          sent_at: string | null
          status: string
          submission_id: string | null
          template_key: string
          title: string
        }
        Insert: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          metadata?: Json
          recipient_email?: string | null
          recipient_type: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          submission_id?: string | null
          template_key: string
          title: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          metadata?: Json
          recipient_email?: string | null
          recipient_type?: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          submission_id?: string | null
          template_key?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          item_code: string
          payment_id: string
          position: number
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          item_code: string
          payment_id: string
          position: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          item_code?: string
          payment_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_line_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          payment_reference: string | null
          provider: string | null
          status: string
          submission_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          payment_reference?: string | null
          provider?: string | null
          status?: string
          submission_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          payment_reference?: string | null
          provider?: string | null
          status?: string
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_views: string[]
          created_at: string
          display_name: string
          email: string
          id: string
          last_opened_at: string | null
          last_signed_in_at: string | null
          requires_account_setup: boolean
          role: string
          terms_accepted_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          access_views?: string[]
          created_at?: string
          display_name?: string
          email: string
          id: string
          last_opened_at?: string | null
          last_signed_in_at?: string | null
          requires_account_setup?: boolean
          role?: string
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          access_views?: string[]
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          last_opened_at?: string | null
          last_signed_in_at?: string | null
          requires_account_setup?: boolean
          role?: string
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      publication_authors: {
        Row: {
          academic_title: string | null
          affiliation: string | null
          author_id: string
          corresponding: boolean
          family_name: string | null
          given_name: string | null
          metadata: Json
          middle_name: string | null
          orcid: string | null
          position: number
          position_title: string | null
          publication_id: string
        }
        Insert: {
          academic_title?: string | null
          affiliation?: string | null
          author_id: string
          corresponding?: boolean
          family_name?: string | null
          given_name?: string | null
          metadata?: Json
          middle_name?: string | null
          orcid?: string | null
          position: number
          position_title?: string | null
          publication_id: string
        }
        Update: {
          academic_title?: string | null
          affiliation?: string | null
          author_id?: string
          corresponding?: boolean
          family_name?: string | null
          given_name?: string | null
          metadata?: Json
          middle_name?: string | null
          orcid?: string | null
          position?: number
          position_title?: string | null
          publication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_authors_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_preflight_checks: {
        Row: {
          blocker: Json | null
          blocking: boolean
          check_group: string
          check_key: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          evidence: Json
          expected_summary: string | null
          id: string
          issue_note: string | null
          mode: string
          observed_summary: string | null
          run_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          blocker?: Json | null
          blocking?: boolean
          check_group: string
          check_key: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          evidence?: Json
          expected_summary?: string | null
          id?: string
          issue_note?: string | null
          mode: string
          observed_summary?: string | null
          run_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          blocker?: Json | null
          blocking?: boolean
          check_group?: string
          check_key?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          evidence?: Json
          expected_summary?: string | null
          id?: string
          issue_note?: string | null
          mode?: string
          observed_summary?: string | null
          run_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_preflight_checks_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_preflight_checks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "publication_preflight_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_preflight_runs: {
        Row: {
          automatic_blocker_count: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          final_snapshot: Json
          id: string
          invalidated_at: string | null
          publication_record_id: string
          ruleset_version: string
          source_fingerprint: string
          source_snapshot: Json
          status: string
          submission_id: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          warning_count: number
        }
        Insert: {
          automatic_blocker_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          final_snapshot?: Json
          id?: string
          invalidated_at?: string | null
          publication_record_id: string
          ruleset_version: string
          source_fingerprint: string
          source_snapshot?: Json
          status?: string
          submission_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          warning_count?: number
        }
        Update: {
          automatic_blocker_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          final_snapshot?: Json
          id?: string
          invalidated_at?: string | null
          publication_record_id?: string
          ruleset_version?: string
          source_fingerprint?: string
          source_snapshot?: Json
          status?: string
          submission_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "publication_preflight_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_preflight_runs_publication_record_id_fkey"
            columns: ["publication_record_id"]
            isOneToOne: false
            referencedRelation: "publication_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_preflight_runs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_preflight_runs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_records: {
        Row: {
          approved_preflight_run_id: string | null
          certificate_file_id: string | null
          citation_data: Json
          created_at: string
          doi: string | null
          doi_registration_status: string
          final_pdf_file_id: string | null
          id: string
          issue_id: string | null
          journal_id: string | null
          latest_preflight_run_id: string | null
          metadata: Json
          public_article_url: string | null
          publication_id: string | null
          published_at: string | null
          scheduled_by: string | null
          scheduled_for: string | null
          social_media_file_id: string | null
          submission_id: string
          submitted_preflight_run_id: string | null
          updated_at: string
        }
        Insert: {
          approved_preflight_run_id?: string | null
          certificate_file_id?: string | null
          citation_data?: Json
          created_at?: string
          doi?: string | null
          doi_registration_status?: string
          final_pdf_file_id?: string | null
          id?: string
          issue_id?: string | null
          journal_id?: string | null
          latest_preflight_run_id?: string | null
          metadata?: Json
          public_article_url?: string | null
          publication_id?: string | null
          published_at?: string | null
          scheduled_by?: string | null
          scheduled_for?: string | null
          social_media_file_id?: string | null
          submission_id: string
          submitted_preflight_run_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_preflight_run_id?: string | null
          certificate_file_id?: string | null
          citation_data?: Json
          created_at?: string
          doi?: string | null
          doi_registration_status?: string
          final_pdf_file_id?: string | null
          id?: string
          issue_id?: string | null
          journal_id?: string | null
          latest_preflight_run_id?: string | null
          metadata?: Json
          public_article_url?: string | null
          publication_id?: string | null
          published_at?: string | null
          scheduled_by?: string | null
          scheduled_for?: string | null
          social_media_file_id?: string | null
          submission_id?: string
          submitted_preflight_run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_records_approved_preflight_run_id_fkey"
            columns: ["approved_preflight_run_id"]
            isOneToOne: false
            referencedRelation: "publication_preflight_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_records_certificate_file_id_fkey"
            columns: ["certificate_file_id"]
            isOneToOne: false
            referencedRelation: "submission_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_records_final_pdf_file_id_fkey"
            columns: ["final_pdf_file_id"]
            isOneToOne: false
            referencedRelation: "submission_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_records_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_records_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_records_latest_preflight_run_id_fkey"
            columns: ["latest_preflight_run_id"]
            isOneToOne: false
            referencedRelation: "publication_preflight_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_records_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: true
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_records_social_media_file_id_fkey"
            columns: ["social_media_file_id"]
            isOneToOne: false
            referencedRelation: "submission_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_records_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_records_submitted_preflight_run_id_fkey"
            columns: ["submitted_preflight_run_id"]
            isOneToOne: false
            referencedRelation: "publication_preflight_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          abstract: string
          author_display: string
          content_type: string
          copyright_holder: string
          created_at: string
          doi: string | null
          downloads: number
          featured: boolean
          id: string
          issue_id: string | null
          issue_number: string | null
          journal_id: string
          keywords: string[]
          legacy_url: string | null
          license_name: string
          license_url: string | null
          pages: string | null
          pdf_url: string | null
          publication_date: string | null
          published_at: string | null
          recommended_citation: string
          slug: string
          sort_order: number
          source_submission_id: string | null
          status: string
          title: string
          updated_at: string
          views: number
          volume: string | null
        }
        Insert: {
          abstract?: string
          author_display?: string
          content_type?: string
          copyright_holder?: string
          created_at?: string
          doi?: string | null
          downloads?: number
          featured?: boolean
          id?: string
          issue_id?: string | null
          issue_number?: string | null
          journal_id: string
          keywords?: string[]
          legacy_url?: string | null
          license_name?: string
          license_url?: string | null
          pages?: string | null
          pdf_url?: string | null
          publication_date?: string | null
          published_at?: string | null
          recommended_citation?: string
          slug: string
          sort_order?: number
          source_submission_id?: string | null
          status?: string
          title: string
          updated_at?: string
          views?: number
          volume?: string | null
        }
        Update: {
          abstract?: string
          author_display?: string
          content_type?: string
          copyright_holder?: string
          created_at?: string
          doi?: string | null
          downloads?: number
          featured?: boolean
          id?: string
          issue_id?: string | null
          issue_number?: string | null
          journal_id?: string
          keywords?: string[]
          legacy_url?: string | null
          license_name?: string
          license_url?: string | null
          pages?: string | null
          pdf_url?: string | null
          publication_date?: string | null
          published_at?: string | null
          recommended_citation?: string
          slug?: string
          sort_order?: number
          source_submission_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          views?: number
          volume?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publications_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          issued_at: string
          payment_id: string
          receipt_number: string
          snapshot: Json
          storage_bucket: string
          storage_path: string | null
          submission_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          issued_at?: string
          payment_id: string
          receipt_number: string
          snapshot?: Json
          storage_bucket?: string
          storage_path?: string | null
          submission_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          issued_at?: string
          payment_id?: string
          receipt_number?: string
          snapshot?: Json
          storage_bucket?: string
          storage_path?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_authors: {
        Row: {
          academic_title: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          institution: string | null
          location: string | null
          middle_initial: string | null
          orcid: string | null
          position: number
          position_title: string | null
          submission_id: string
          surname: string
          updated_at: string
        }
        Insert: {
          academic_title?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          institution?: string | null
          location?: string | null
          middle_initial?: string | null
          orcid?: string | null
          position: number
          position_title?: string | null
          submission_id: string
          surname?: string
          updated_at?: string
        }
        Update: {
          academic_title?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          institution?: string | null
          location?: string | null
          middle_initial?: string | null
          orcid?: string | null
          position?: number
          position_title?: string | null
          submission_id?: string
          surname?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_authors_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_files: {
        Row: {
          created_at: string
          created_by: string | null
          file_kind: string
          id: string
          mime_type: string
          original_name: string
          sha256: string | null
          size_bytes: number
          storage_bucket: string
          storage_path: string
          submission_id: string
          supersedes_file_id: string | null
          validated_at: string | null
          validation_metadata: Json
          validation_status: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_kind: string
          id?: string
          mime_type: string
          original_name: string
          sha256?: string | null
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          submission_id: string
          supersedes_file_id?: string | null
          validated_at?: string | null
          validation_metadata?: Json
          validation_status?: string
          version_number?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_kind?: string
          id?: string
          mime_type?: string
          original_name?: string
          sha256?: string | null
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          submission_id?: string
          supersedes_file_id?: string | null
          validated_at?: string | null
          validation_metadata?: Json
          validation_status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "submission_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_files_supersedes_file_id_fkey"
            columns: ["supersedes_file_id"]
            isOneToOne: false
            referencedRelation: "submission_files"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_history: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          message: string
          submission_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          message: string
          submission_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          abstract: string
          affiliation: string | null
          assigned_issue_id: string | null
          author_details: Json
          author_email: string
          author_name: string
          author_notes: string | null
          author_user_id: string | null
          consent_at: string
          created_at: string
          current_stage: Database["public"]["Enums"]["workflow_stage"]
          id: string
          idempotency_key: string | null
          issue_snapshot: string
          journal_title_snapshot: string
          phone: string | null
          preferred_journal_id: string | null
          priority: string
          publication_type: string
          reference: string
          review_settings: Json
          source_ip_hash: string | null
          status: string
          submitted_at: string | null
          title: string
          tracking_number: string
          updated_at: string
          volume_snapshot: string
        }
        Insert: {
          abstract: string
          affiliation?: string | null
          assigned_issue_id?: string | null
          author_details?: Json
          author_email: string
          author_name: string
          author_notes?: string | null
          author_user_id?: string | null
          consent_at: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["workflow_stage"]
          id?: string
          idempotency_key?: string | null
          issue_snapshot?: string
          journal_title_snapshot?: string
          phone?: string | null
          preferred_journal_id?: string | null
          priority?: string
          publication_type: string
          reference: string
          review_settings?: Json
          source_ip_hash?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          tracking_number?: string
          updated_at?: string
          volume_snapshot?: string
        }
        Update: {
          abstract?: string
          affiliation?: string | null
          assigned_issue_id?: string | null
          author_details?: Json
          author_email?: string
          author_name?: string
          author_notes?: string | null
          author_user_id?: string | null
          consent_at?: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["workflow_stage"]
          id?: string
          idempotency_key?: string | null
          issue_snapshot?: string
          journal_title_snapshot?: string
          phone?: string | null
          preferred_journal_id?: string | null
          priority?: string
          publication_type?: string
          reference?: string
          review_settings?: Json
          source_ip_hash?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          tracking_number?: string
          updated_at?: string
          volume_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assigned_issue_id_fkey"
            columns: ["assigned_issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_preferred_journal_id_fkey"
            columns: ["preferred_journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          item_key: string
          metadata: Json
          required: boolean
          stage: Database["public"]["Enums"]["workflow_stage"]
          submission_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          item_key: string
          metadata?: Json
          required?: boolean
          stage: Database["public"]["Enums"]["workflow_stage"]
          submission_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          item_key?: string
          metadata?: Json
          required?: boolean
          stage?: Database["public"]["Enums"]["workflow_stage"]
          submission_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_checklist_items_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          event_type: string
          from_stage: Database["public"]["Enums"]["workflow_stage"] | null
          id: string
          internal_description: string
          internal_title: string
          metadata: Json
          public_description: string | null
          public_title: string | null
          submission_id: string
          to_stage: Database["public"]["Enums"]["workflow_stage"] | null
          visibility: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string
          event_type: string
          from_stage?: Database["public"]["Enums"]["workflow_stage"] | null
          id?: string
          internal_description?: string
          internal_title?: string
          metadata?: Json
          public_description?: string | null
          public_title?: string | null
          submission_id: string
          to_stage?: Database["public"]["Enums"]["workflow_stage"] | null
          visibility?: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          event_type?: string
          from_stage?: Database["public"]["Enums"]["workflow_stage"] | null
          id?: string
          internal_description?: string
          internal_title?: string
          metadata?: Json
          public_description?: string | null
          public_title?: string | null
          submission_id?: string
          to_stage?: Database["public"]["Enums"]["workflow_stage"] | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_transition_publication: {
        Args: {
          p_actor_id: string
          p_preflight_run_id?: string
          p_reason?: string
          p_scheduled_for?: string
          p_submission_id: string
          p_to_stage: Database["public"]["Enums"]["workflow_stage"]
        }
        Returns: {
          abstract: string
          affiliation: string | null
          assigned_issue_id: string | null
          author_details: Json
          author_email: string
          author_name: string
          author_notes: string | null
          author_user_id: string | null
          consent_at: string
          created_at: string
          current_stage: Database["public"]["Enums"]["workflow_stage"]
          id: string
          idempotency_key: string | null
          issue_snapshot: string
          journal_title_snapshot: string
          phone: string | null
          preferred_journal_id: string | null
          priority: string
          publication_type: string
          reference: string
          review_settings: Json
          source_ip_hash: string | null
          status: string
          submitted_at: string | null
          title: string
          tracking_number: string
          updated_at: string
          volume_snapshot: string
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      allocate_certificate_number: { Args: { p_year: number }; Returns: string }
      complete_workflow_checklist_item: {
        Args: {
          p_actor_id: string
          p_checklist_item_id: string
          p_completed?: boolean
        }
        Returns: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          item_key: string
          metadata: Json
          required: boolean
          stage: Database["public"]["Enums"]["workflow_stage"]
          submission_id: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "workflow_checklist_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      configure_submission_payment: {
        Args: {
          p_actor_id?: string
          p_currency?: string
          p_lines?: Json
          p_metadata?: Json
          p_payment_id?: string
          p_payment_reference?: string
          p_provider?: string
          p_submission_id: string
        }
        Returns: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          payment_reference: string | null
          provider: string | null
          status: string
          submission_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_payment_and_start_review: {
        Args: {
          p_actor_id: string
          p_payment_id: string
          p_submission_id: string
        }
        Returns: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          payment_reference: string | null
          provider: string | null
          status: string
          submission_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_submission_payment: {
        Args: { p_actor_id: string; p_payment_id: string }
        Returns: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          payment_reference: string | null
          provider: string | null
          status: string
          submission_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_author_request: {
        Args: {
          p_actor_id: string
          p_description?: string
          p_due_at?: string
          p_request_type: string
          p_submission_id: string
          p_title: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          description: string
          due_at: string | null
          id: string
          request_type: string
          responded_at: string | null
          response: string | null
          response_choice: string | null
          status: string
          submission_id: string
          title: string
          updated_at: string
          visible_to_author: boolean
          workflow_event_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "author_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_submission_cascade: {
        Args: { p_submission_id: string }
        Returns: Json
      }
      increment_publication_metric: {
        Args: { p_field: string; p_publication_id: string }
        Returns: undefined
      }
      respond_to_author_request: {
        Args: {
          p_request_id: string
          p_response_choice: string
          p_submission_id: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          description: string
          due_at: string | null
          id: string
          request_type: string
          responded_at: string | null
          response: string | null
          response_choice: string | null
          status: string
          submission_id: string
          title: string
          updated_at: string
          visible_to_author: boolean
          workflow_event_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "author_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_submission: {
        Args: {
          p_actor_id: string
          p_internal_description?: string
          p_internal_title?: string
          p_metadata?: Json
          p_public_description?: string
          p_public_title?: string
          p_submission_id: string
          p_to_stage: Database["public"]["Enums"]["workflow_stage"]
          p_visibility?: string
        }
        Returns: {
          abstract: string
          affiliation: string | null
          assigned_issue_id: string | null
          author_details: Json
          author_email: string
          author_name: string
          author_notes: string | null
          author_user_id: string | null
          consent_at: string
          created_at: string
          current_stage: Database["public"]["Enums"]["workflow_stage"]
          id: string
          idempotency_key: string | null
          issue_snapshot: string
          journal_title_snapshot: string
          phone: string | null
          preferred_journal_id: string | null
          priority: string
          publication_type: string
          reference: string
          review_settings: Json
          source_ip_hash: string | null
          status: string
          submitted_at: string | null
          title: string
          tracking_number: string
          updated_at: string
          volume_snapshot: string
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      workflow_stage:
        | "review_new"
        | "review_in_progress"
        | "review_final"
        | "review_accepted"
        | "production_ready"
        | "production_preparation"
        | "production_proof"
        | "production_records"
        | "production_ready_to_publish"
        | "production_scheduled"
        | "published"
        | "closed"
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
      workflow_stage: [
        "review_new",
        "review_in_progress",
        "review_final",
        "review_accepted",
        "production_ready",
        "production_preparation",
        "production_proof",
        "production_records",
        "production_ready_to_publish",
        "production_scheduled",
        "published",
        "closed",
      ],
    },
  },
} as const

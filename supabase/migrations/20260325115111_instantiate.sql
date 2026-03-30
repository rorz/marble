-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.column (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  table_id uuid NOT NULL,
  CONSTRAINT column_pkey PRIMARY KEY (id),
  CONSTRAINT column_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table(id)
);

CREATE TABLE public.row (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  column_id uuid NOT NULL,
  CONSTRAINT row_pkey PRIMARY KEY (id),
  CONSTRAINT row_author_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id),
  CONSTRAINT row_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.column(id)
);

CREATE TABLE public.table (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT table_pkey PRIMARY KEY (id)
);

CREATE TABLE public.team (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,


  
)
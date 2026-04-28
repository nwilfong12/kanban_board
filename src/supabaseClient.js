import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://zoerfryrazjntpeqhnjx.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvZXJmcnlyYXpqbnRwZXFobmp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTI5NDIsImV4cCI6MjA5MjUyODk0Mn0.0wrlyEfd220X0kdy46zjFBCZu040JaT9vMk0mPpsteg"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
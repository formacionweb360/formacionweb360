import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://brazwbyfwcafscpfqhqf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyYXp3Ynlmd2NhZnNjcGZxaHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3OTY0NjIsImV4cCI6MjA3ODM3MjQ2Mn0._rvVLjpv1hCqGL-ptDVD3IYohavdh8ax4S8PZ1Q7UYQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

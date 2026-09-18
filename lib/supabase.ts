import { createClient } from '@supabase/supabase-js'

// Your Supabase connection
const supabaseUrl = 'https://pntupipfknihednpcnta.supabase.co'
const supabaseKey = 'sb_publishable_EC6LWESTKfeaR7Xb3q6VnA_Cg_vX5zP'

export const supabase = createClient(supabaseUrl, supabaseKey)
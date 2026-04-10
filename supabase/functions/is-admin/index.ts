import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const adminEmail = Deno.env.get('ADMIN_EMAIL')
  if (!adminEmail) {
    return new Response(JSON.stringify({ isAdmin: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ isAdmin: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error } = await anonClient.auth.getUser()
  if (error || !user) {
    return new Response(JSON.stringify({ isAdmin: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const isAdmin = user.email === adminEmail

  // Keep profiles.is_admin in sync if it's out of date
  if (isAdmin) {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    await serviceClient
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', user.id)
      .eq('is_admin', false) // only write if not already set
  }

  return new Response(JSON.stringify({ isAdmin }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

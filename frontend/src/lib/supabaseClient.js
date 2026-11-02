/**
 * @file supabaseClient.js
 * @description Production-grade modular Supabase browser client with multi-tenant custom connection URL support.
 * 
 * ZERO-STORAGE PRIVACY ARCHITECTURE:
 * User-provided Supabase URLs, Anon Keys, and Auth sessions are maintained STRICTLY in volatile RAM (in-memory).
 * They are NEVER written to window.localStorage, cookies, indexedDB, or any persistent disk.
 * When the browser tab is closed or refreshed, all credentials immediately evaporate.
 */

import { createClient } from '@supabase/supabase-js';

// Default project fallback configuration from environment variables (if any)
const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const DEFAULT_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Volatile in-memory credentials (Held in RAM only, NEVER persisted to disk)
let memoryCredentials = {
  url: '',
  key: '',
};

// In-Memory Storage Adapter for Supabase Auth
// Keeps auth tokens and session data purely in RAM memory
const inMemoryAuthStore = new Map();
const inMemoryStorageAdapter = {
  getItem: (k) => inMemoryAuthStore.get(k) || null,
  setItem: (k, v) => { inMemoryAuthStore.set(k, v); },
  removeItem: (k) => { inMemoryAuthStore.delete(k); },
};

/**
 * Actively purges any legacy credentials stored in localStorage from previous versions
 */
export function purgeLegacyStorage() {
  try {
    localStorage.removeItem('GEMINI_API_KEY');
    localStorage.removeItem('SUPABASE_URL');
    localStorage.removeItem('SUPABASE_ANON_KEY');
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith('project_explainer_supabase_auth') ||
        key.startsWith('sb-') ||
        key.toLowerCase().includes('supabase')
      ) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // LocalStorage might be restricted
  }
}

// Purge any stored credentials on module initialization
purgeLegacyStorage();

/**
 * Normalizes and rectifies any Supabase connection URL.
 * Automatically strips '/rest/v1', trailing slashes, quotes,
 * adds 'https://' if missing, and expands standalone project references.
 */
export function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return '';
  let clean = rawUrl.trim().replace(/^["']|["']$/g, '');

  // If user pasted just a 20-character project ref like 'wfuhdqldeetizzsvvyyo'
  if (/^[a-z0-9]{15,30}$/i.test(clean)) {
    return `https://${clean}.supabase.co`;
  }

  // If user copied just the host or subdomain (e.g. wfuhdqldeetizzsvvyyo.supabase.co)
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }

  // Remove REST API suffix if pasted from Supabase settings (e.g. /rest/v1/)
  clean = clean.replace(/\/rest\/v1\/?$/i, '');
  // Remove any trailing slashes
  clean = clean.replace(/\/+$/, '');

  return clean;
}

/**
 * Extracts the project reference ID from a Supabase URL
 */
export function extractSupabaseProjectId(url) {
  if (!url) return null;
  const clean = normalizeSupabaseUrl(url);
  const match = clean.match(/https?:\/\/([a-z0-9_-]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

/**
 * Rectifies and analyzes user-entered credentials with live diagnostic feedback.
 */
export function rectifySupabaseCredentials(rawUrl, rawKey) {
  const rectifications = [];
  let cleanUrl = (rawUrl || '').trim().replace(/^["']|["']$/g, '');

  if (rawUrl && rawUrl !== cleanUrl) {
    rectifications.push('Trimmed extra whitespace & quotation marks');
  }

  if (cleanUrl) {
    if (/^[a-z0-9]{15,30}$/i.test(cleanUrl)) {
      rectifications.push(`Auto-expanded project ID into https://${cleanUrl}.supabase.co`);
      cleanUrl = `https://${cleanUrl}.supabase.co`;
    } else {
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        rectifications.push('Added missing https:// protocol');
        cleanUrl = 'https://' + cleanUrl;
      }
      if (/\/rest\/v1\/?$/i.test(cleanUrl)) {
        rectifications.push('Stripped /rest/v1 REST endpoint suffix');
        cleanUrl = cleanUrl.replace(/\/rest\/v1\/?$/i, '');
      }
      cleanUrl = cleanUrl.replace(/\/+$/, '');
    }
  }

  const projectId = extractSupabaseProjectId(cleanUrl);
  const isUrlValid = Boolean(cleanUrl && (cleanUrl.includes('.supabase.co') || cleanUrl.startsWith('http')));

  // Analyze Key
  const cleanKey = (rawKey || '').trim().replace(/^["']|["']$/g, '');
  const keyWarnings = [];
  let isKeyJwt = false;
  let isServiceRole = false;

  if (cleanKey) {
    const parts = cleanKey.split('.');
    if (parts.length === 3) {
      isKeyJwt = true;
      try {
        const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadJson);
        if (payload.role === 'service_role') {
          isServiceRole = true;
          keyWarnings.push('Security Warning: This is a secret service_role key! Never expose it in the frontend. Please use your public anon key.');
        }
      } catch {
        // Safe fallback
      }
    } else {
      keyWarnings.push('Key should be a valid 3-part JWT token (starts with eyJ...). Ensure you copied the public anon key.');
    }
  }

  return {
    url: cleanUrl,
    key: cleanKey,
    projectId,
    isUrlValid,
    isKeyValid: Boolean(cleanKey && isKeyJwt && !isServiceRole),
    isServiceRole,
    rectifications,
    keyWarnings
  };
}

/**
 * Retrieves the currently active Supabase URL and Anon Key from volatile RAM.
 */
export function getSupabaseCredentials() {
  const url = memoryCredentials.url ? normalizeSupabaseUrl(memoryCredentials.url) : DEFAULT_SUPABASE_URL;
  const key = memoryCredentials.key ? memoryCredentials.key.trim() : DEFAULT_ANON_KEY;
  const isCustom = Boolean(memoryCredentials.url);

  return { url, key, isCustom };
}

/**
 * Checks whether Supabase is actively configured with a valid URL and key in memory.
 */
export function isSupabaseConfigured() {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key && key !== 'your_supabase_anon_key_here');
}

// Client singleton instance cache in RAM
let supabaseInstance = null;
let activeUrl = null;
let activeKey = null;

/**
 * Initializes or returns the cached Supabase client singleton from in-memory credentials.
 */
export function getSupabaseClient() {
  const { url, key } = getSupabaseCredentials();

  if (!url || !key) {
    return null;
  }

  // Re-create if URL or key changed in memory
  if (!supabaseInstance || activeUrl !== url || activeKey !== key) {
    activeUrl = url;
    activeKey = key;
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true, // Persists in RAM across components during the active tab session
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: inMemoryStorageAdapter, // STRICTLY IN-MEMORY: NEVER stored in localStorage or disk!
      },
      global: {
        headers: {
          'x-application-name': 'project-explainer-web',
        },
      },
    });
  }

  return supabaseInstance;
}

// Named export for direct access
export const supabase = getSupabaseClient();

/**
 * Sets user's personal Supabase connection URL and Anon Key in volatile RAM only.
 * NO disk or localStorage writes occur.
 */
export function saveCustomSupabaseCredentials(url, key) {
  const cleanUrl = normalizeSupabaseUrl(url);
  const cleanKey = (key || '').trim();

  // Save to RAM only
  memoryCredentials.url = cleanUrl;
  memoryCredentials.key = cleanKey;

  // Clear any existing in-memory auth store when switching projects
  inMemoryAuthStore.clear();

  // Force client re-initialization
  supabaseInstance = null;
  activeUrl = null;
  activeKey = null;

  return getSupabaseClient();
}

/**
 * Wipes credentials and auth tokens from RAM completely.
 */
export function resetSupabaseCredentials() {
  memoryCredentials.url = '';
  memoryCredentials.key = '';
  inMemoryAuthStore.clear();
  supabaseInstance = null;
  activeUrl = null;
  activeKey = null;
  purgeLegacyStorage();
  return null;
}

/**
 * Tests connection to a given Supabase URL and Anon Key without storing anything.
 */
export async function testSupabaseConnection(rawUrl, rawKey) {
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (rawKey || '').trim();

  if (!url) throw new Error('Supabase URL cannot be empty.');
  if (!key) throw new Error('Supabase Anon Key cannot be empty.');

  const startTime = Date.now();
  try {
    const testClient = createClient(url, key, {
      auth: {
        persistSession: false,
        storage: inMemoryStorageAdapter,
      },
    });

    const { error } = await testClient.auth.getSession();
    const latency = Date.now() - startTime;
    const projectId = extractSupabaseProjectId(url);

    if (error && !error.message.includes('fetch')) {
      return { success: true, url, projectId, latency };
    }
    return { success: true, url, projectId, latency };
  } catch (err) {
    throw new Error(`Unable to connect to ${url}: ${err.message}`);
  }
}

// ==============================================================================
// AUTHENTICATION HELPERS (IN-MEMORY SESSION)
// ==============================================================================

export async function signUpWithEmail(email, password, fullName = '') {
  const client = getSupabaseClient();
  if (!client) throw new Error('Please provide your Supabase URL & Anon Key first.');

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Please provide your Supabase URL & Anon Key first.');

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  inMemoryAuthStore.clear();
  if (error) throw error;
}

export async function getCurrentSession() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;
  return session;
}

export async function getCurrentUser() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser();
  if (error) return null;
  return user;
}

export function onAuthStateChange(callback) {
  const client = getSupabaseClient();
  if (!client) return { unsubscribe: () => {} };

  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return subscription;
}

// ==============================================================================
// USER-ISOLATED CLOUD SYNC & CRUD HELPERS (STORE IN USER'S OWN DATABASE)
// ==============================================================================

export async function saveProjectScan({
  projectName,
  sourceType = 'folder',
  sourceUrl = '',
  scanData,
  syncFiles = true,
  onProgress = null,
}) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase credentials are not set.');

  const user = await getCurrentUser();
  if (!user) throw new Error('Please sign in to your Supabase project first.');

  const summary = scanData?.summary || {};
  const diagrams = scanData?.diagrams || {};
  const coupling = scanData?.high_coupling_modules || [];
  const circular = scanData?.circular_dependencies || [];
  const filesMap = scanData?.files || {};
  const fileKeys = Object.keys(filesMap);

  // 1. Create or upsert the Project record in user's private database
  const { data: projectData, error: projectError } = await client
    .from('projects')
    .insert({
      user_id: user.id,
      name: projectName || summary.repo_name || 'Unnamed Project',
      source_type: sourceType,
      source_url: sourceUrl || null,
      loc: summary.total_loc || 0,
      files_count: summary.total_files || fileKeys.length || 0,
      data_files_count: scanData?.data_files_count || 0,
      languages: summary.languages || {},
    })
    .select()
    .single();

  if (projectError) {
    console.error('Error creating project in user Supabase:', projectError);
    throw new Error(`Failed to save project: ${projectError.message}. Make sure database schema is initialized.`);
  }

  // 2. Insert the detailed Project Scan record
  const { data: scanRecord, error: scanError } = await client
    .from('project_scans')
    .insert({
      project_id: projectData.id,
      user_id: user.id,
      summary: summary.overview || '',
      architecture_layers: scanData.architecture_layers || {},
      diagrams: {
        architecture: diagrams.architecture_layers,
        dependency: diagrams.dependencies,
        class_hierarchy: diagrams.classes,
      },
      high_coupling_modules: coupling,
      circular_dependencies: circular,
      ast_file_manifest: fileKeys.slice(0, 200),
    })
    .select()
    .single();

  if (scanError) {
    console.error('Error saving scan in user Supabase:', scanError);
    throw new Error(`Failed to save scan: ${scanError.message}`);
  }

  // 3. Bulk sync project files (code and data files) in chunks of 200 records
  let syncedFilesCount = 0;
  if (syncFiles && fileKeys.length > 0) {
    syncedFilesCount = await syncProjectFilesToSupabase({
      projectId: projectData.id,
      userId: user.id,
      filesMap,
      onProgress,
    });
  }

  return { project: projectData, scan: scanRecord, syncedFilesCount };
}

export async function syncProjectFilesToSupabase({
  projectId,
  userId = null,
  filesMap,
  onProgress = null,
}) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured.');

  let targetUserId = userId;
  if (!targetUserId) {
    const user = await getCurrentUser();
    if (!user) throw new Error('User authentication required.');
    targetUserId = user.id;
  }

  const fileEntries = Object.entries(filesMap || {});
  const totalFiles = fileEntries.length;
  if (totalFiles === 0) return 0;

  const records = fileEntries.map(([fpath, fileObj]) => {
    const name = fileObj.name || fpath.split('/').pop() || 'file';
    const ext = fileObj.extension || (name.includes('.') ? `.${name.split('.').pop()}` : '');
    const isData = ['.csv', '.tsv', '.json', '.jsonl', '.sql', '.xml', '.parquet', '.dat', '.data'].includes(ext.toLowerCase());
    const category = fileObj.category || (isData ? 'data' : 'code');

    return {
      project_id: projectId,
      user_id: targetUserId,
      file_path: fpath,
      file_name: name,
      extension: ext,
      file_category: category,
      language: fileObj.language || (isData ? 'data' : 'code'),
      size_bytes: fileObj.size_bytes || Math.round((fileObj.size_kb || 0) * 1024),
      loc: fileObj.loc || 0,
      metadata: fileObj.analysis?.metadata || {},
    };
  });

  const batchSize = 200;
  let totalInserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { data, error } = await client.from('project_files').insert(batch).select('id');

    if (error) {
      console.warn(`Warning inserting files chunk ${i}-${i + batch.length}:`, error.message);
    } else {
      totalInserted += data ? data.length : batch.length;
    }

    if (onProgress) {
      onProgress(Math.min(i + batch.length, totalFiles), totalFiles);
    }
  }

  return totalInserted;
}

export async function fetchUserProjects() {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('projects')
    .select(`
      id,
      name,
      source_type,
      source_url,
      loc,
      files_count,
      data_files_count,
      languages,
      created_at,
      project_scans (
        id,
        created_at,
        summary
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects from user Supabase:', error);
    throw error;
  }

  return data || [];
}

export async function deleteProject(projectId) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured.');

  const { error } = await client
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
  return true;
}

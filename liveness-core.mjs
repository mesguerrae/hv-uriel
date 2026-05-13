const HARD_EXPIRED_PATTERNS = [
  /job (is )?no longer available/i,
  /job.*no longer open/i,
  /position has been filled/i,
  /this job has expired/i,
  /job posting has expired/i,
  /no longer accepting applications/i,
  /this (position|role|job) (is )?no longer/i,
  /this job (listing )?is closed/i,
  /job (listing )?not found/i,
  /the page you are looking for doesn.t exist/i,
  /applications?\s+(?:(?:have|are|is)\s+)?closed/i,
  /closed on \d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /closed on (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i,
  /diese stelle (ist )?(nicht mehr|bereits) besetzt/i,
  /offre (expirée|n'est plus disponible)/i,
  // Spanish / LATAM expired signals
  /esta (oferta|vacante|posici[oó]n) (ya )?no (est[aá] disponible|acepta)/i,
  /ya no (se )?aceptan? (más )?(solicitudes|candidaturas|postulaciones)/i,
  /oferta (cerrada|caducada|expirada|finalizada)/i,
  /vacante (cerrada|no disponible)/i,
  /proceso (de selecci[oó]n )?(cerrado|finalizado)/i,
  /esta (publicaci[oó]n|oferta) ya (no )?est[aá] (activa|vigente)/i,
  /b[uú]squeda (cerrada|finalizada)/i,
];

const LISTING_PAGE_PATTERNS = [
  /\d+\s+jobs?\s+found/i,
  /search for jobs page is loaded/i,
];

const EXPIRED_URL_PATTERNS = [
  /[?&]error=true/i,
  // LinkedIn redirects expired jobs to the search page
  /linkedin\.com\/jobs\/search(?:\/|\?|$)/i,
  // LinkedIn sign-in wall for expired/invalid postings
  /linkedin\.com\/authwall/i,
  /linkedin\.com\/login/i,
];

// Matches "Posted N months ago" / "Hace N meses" when N >= 2 → likely stale
const STALE_POSTING_PATTERNS = [
  /posted\s+(?:[2-9]|\d{2,})\s+months?\s+ago/i,
  /hace\s+(?:[2-9]|\d{2,})\s+meses/i,
  /publicad[oa]\s+hace\s+(?:[2-9]|\d{2,})\s+meses/i,
];

const APPLY_PATTERNS = [
  /\bapply\b/i,
  /\bsolicitar\b/i,
  /\bbewerben\b/i,
  /\bpostuler\b/i,
  /submit application/i,
  /easy apply/i,
  /start application/i,
  /ich bewerbe mich/i,
];

const MIN_CONTENT_CHARS = 300;

function firstMatch(patterns, text = '') {
  return patterns.find((pattern) => pattern.test(text));
}

function hasApplyControl(controls = []) {
  return controls.some((control) => APPLY_PATTERNS.some((pattern) => pattern.test(control)));
}

export function classifyLiveness({ status = 0, finalUrl = '', bodyText = '', applyControls = [] } = {}) {
  if (status === 404 || status === 410) {
    return { result: 'expired', reason: `HTTP ${status}` };
  }

  const expiredUrl = firstMatch(EXPIRED_URL_PATTERNS, finalUrl);
  if (expiredUrl) {
    return { result: 'expired', reason: `redirect to ${finalUrl}` };
  }

  const expiredBody = firstMatch(HARD_EXPIRED_PATTERNS, bodyText);
  if (expiredBody) {
    return { result: 'expired', reason: `pattern matched: ${expiredBody.source}` };
  }

  const stalePost = firstMatch(STALE_POSTING_PATTERNS, bodyText);
  if (stalePost) {
    return { result: 'expired', reason: `stale posting (>=2 months): ${stalePost.source}` };
  }

  if (hasApplyControl(applyControls)) {
    return { result: 'active', reason: 'visible apply control detected' };
  }

  const listingPage = firstMatch(LISTING_PAGE_PATTERNS, bodyText);
  if (listingPage) {
    return { result: 'expired', reason: `pattern matched: ${listingPage.source}` };
  }

  if (bodyText.trim().length < MIN_CONTENT_CHARS) {
    return { result: 'expired', reason: 'insufficient content — likely nav/footer only' };
  }

  return { result: 'uncertain', reason: 'content present but no visible apply control found' };
}

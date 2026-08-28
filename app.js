import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js'

const LEGACY_STORAGE_KEY = 'excelJobs'
const LEGACY_BACKUP_PREFIX = 'excelJobsBackup:'
const DB_COLUMNS = 'id, company, role, deadline, link, jd, preferred, cover_letter, document_prepared, doc_status, interview1_date, interview1_result, interview2_date, interview2_result, final_status, created_at, updated_at'

const DOC_STATUSES = ['대기', '합격', '탈락']
const INTERVIEW_STATUSES = ['미대상', '대기', '합격', '탈락']
const FINAL_STATUSES = ['진행중', '최종합격', '최종탈락']

const loadingPanel = document.querySelector('#loadingPanel')
const setupPanel = document.querySelector('#setupPanel')
const authPanel = document.querySelector('#authPanel')
const dashboard = document.querySelector('#dashboard')
const accountBar = document.querySelector('#accountBar')
const accountEmail = document.querySelector('#accountEmail')
const logoutButton = document.querySelector('#logoutButton')
const exportButton = document.querySelector('#exportButton')

const googleLoginButton = document.querySelector('#googleLoginButton')
const authMessage = document.querySelector('#authMessage')

const migrationPanel = document.querySelector('#migrationPanel')
const legacyCount = document.querySelector('#legacyCount')
const migrationButton = document.querySelector('#migrationButton')
const appMessage = document.querySelector('#appMessage')

const jobForm = document.querySelector('#jobForm')
const companyInput = document.querySelector('#companyInput')
const roleInput = document.querySelector('#roleInput')
const dateInput = document.querySelector('#dateInput')
const documentPreparedInput = document.querySelector('#documentPreparedInput')
const linkInput = document.querySelector('#linkInput')
const jdInput = document.querySelector('#jdInput')
const preferredInput = document.querySelector('#preferredInput')
const coverLetterInput = document.querySelector('#coverLetterInput')
const docStatusInput = document.querySelector('#docStatusInput')
const interview1Date = document.querySelector('#interview1Date')
const interview1Result = document.querySelector('#interview1Result')
const interview2Date = document.querySelector('#interview2Date')
const interview2Result = document.querySelector('#interview2Result')
const finalStatusInput = document.querySelector('#finalStatusInput')
const submitButton = document.querySelector('#submitButton')
const cancelEditButton = document.querySelector('#cancelEditButton')
const searchInput = document.querySelector('#searchInput')
const preparedFilter = document.querySelector('#preparedFilter')
const statusFilter = document.querySelector('#statusFilter')
const countText = document.querySelector('#countText')
const emptyMessage = document.querySelector('#emptyMessage')
const jobTableBody = document.querySelector('#jobTableBody')

const summaryTotal = document.querySelector('#summaryTotal')
const summaryPrepared = document.querySelector('#summaryPrepared')
const summaryPreparedMeta = document.querySelector('#summaryPreparedMeta')
const summaryWaiting = document.querySelector('#summaryWaiting')
const summaryDocPassRate = document.querySelector('#summaryDocPassRate')
const summaryDocPassMeta = document.querySelector('#summaryDocPassMeta')
const summaryInterview = document.querySelector('#summaryInterview')
const summaryInterviewMeta = document.querySelector('#summaryInterviewMeta')

const textModal = document.querySelector('#textModal')
const modalTitle = document.querySelector('#modalTitle')
const modalBodyText = document.querySelector('#modalBodyText')
const closeModalBtn = document.querySelector('#closeModalBtn')

let supabaseClient = null
let currentUser = null
let jobs = []
let editingId = null
let authViewVersion = 0

initialize()

async function initialize() {
  if (typeof window.supabase?.createClient !== 'function') {
    loadingPanel.hidden = true
    setupPanel.hidden = false
    const detail = document.createElement('p')
    detail.className = 'message error'
    detail.textContent = '보안 검증된 Supabase 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'
    setupPanel.appendChild(detail)
    return
  }

  const configError = validateSupabaseConfig()
  if (configError) {
    loadingPanel.hidden = true
    setupPanel.hidden = false
    const detail = document.createElement('p')
    detail.className = 'message error'
    detail.textContent = configError
    setupPanel.appendChild(detail)
    return
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })

  const { data, error } = await supabaseClient.auth.getSession()
  if (error) {
    loadingPanel.hidden = true
    showAuthPanel('로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.', true)
  } else {
    await applySession(data.session)
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      void applySession(session)
    }, 0)
  })
}

function validateSupabaseConfig() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_PROJECT_REF')) {
    return 'Supabase 프로젝트 URL이 아직 설정되지 않았습니다.'
  }

  let parsedUrl
  try {
    parsedUrl = new URL(SUPABASE_URL)
  } catch {
    return 'Supabase 프로젝트 URL 형식이 올바르지 않습니다.'
  }

  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
    return 'HTTPS를 사용하는 공식 Supabase 프로젝트 URL만 허용됩니다.'
  }

  if (!SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY.includes('YOUR_SUPABASE')) {
    return 'Supabase Publishable key가 아직 설정되지 않았습니다.'
  }

  if (SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_')) {
    return 'Secret key가 감지되어 연결을 차단했습니다. Publishable key만 사용하세요.'
  }

  if (!SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
    return 'sb_publishable_ 로 시작하는 Publishable key만 사용할 수 있습니다.'
  }

  return ''
}

async function applySession(session) {
  const viewVersion = ++authViewVersion
  loadingPanel.hidden = true

  if (!session?.user) {
    currentUser = null
    jobs = []
    editingId = null
    renderJobs()
    showAuthPanel()
    return
  }

  currentUser = session.user
  authPanel.hidden = true
  setupPanel.hidden = true
  dashboard.hidden = false
  accountBar.hidden = false
  accountEmail.textContent = currentUser.email || '로그인됨'

  await loadJobs()
  if (viewVersion !== authViewVersion) return
  await refreshMigrationPanel()
}

function showAuthPanel(message = '', isError = false) {
  dashboard.hidden = true
  accountBar.hidden = true
  migrationPanel.hidden = true
  setupPanel.hidden = true
  authPanel.hidden = false
  setAuthMessage(message, isError)
}

googleLoginButton.addEventListener('click', async () => {
  googleLoginButton.disabled = true
  setAuthMessage('Google 로그인 화면으로 이동하는 중입니다.')
  const redirectUrl = `${window.location.origin}${window.location.pathname}`
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      scopes: 'openid email profile'
    }
  })

  googleLoginButton.disabled = false
  if (error) {
    setAuthMessage(friendlyAuthError(error), true)
  }
})

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true
  const { error } = await supabaseClient.auth.signOut({ scope: 'local' })
  logoutButton.disabled = false

  if (error) {
    showAppMessage('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.', true)
    return
  }

  await applySession(null)
})

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message
  authMessage.classList.toggle('error', isError)
}

function friendlyAuthError(error) {
  const message = String(error?.message || '')
  if (/rate limit/i.test(message)) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  return 'Google 로그인을 시작하지 못했습니다. Supabase의 Google Provider와 Redirect URL 설정을 확인해 주세요.'
}

async function loadJobs() {
  showAppMessage('데이터를 불러오는 중입니다.')

  const { data, error } = await supabaseClient
    .from('jobs')
    .select(DB_COLUMNS)
    .order('deadline', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    jobs = []
    renderJobs()
    showAppMessage('데이터를 불러오지 못했습니다. Supabase SQL 설정과 인터넷 연결을 확인해 주세요.', true)
    return false
  }

  jobs = data.map(fromDatabaseJob)
  renderJobs()
  showAppMessage('')
  return true
}

function fromDatabaseJob(row) {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    date: row.deadline,
    link: row.link || '',
    jd: row.jd || '',
    preferred: row.preferred || '',
    coverLetter: row.cover_letter || '',
    documentPrepared: row.document_prepared === true,
    docStatus: row.doc_status,
    interview1Date: row.interview1_date || '',
    interview1Result: row.interview1_result,
    interview2Date: row.interview2_date || '',
    interview2Result: row.interview2_result,
    finalStatus: row.final_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function getFormJobData() {
  return {
    company: companyInput.value.trim(),
    role: roleInput.value.trim(),
    deadline: dateInput.value,
    link: safeHttpUrl(linkInput.value.trim()),
    jd: jdInput.value,
    preferred: preferredInput.value,
    cover_letter: coverLetterInput.value,
    document_prepared: documentPreparedInput.checked,
    doc_status: docStatusInput.value,
    interview1_date: interview1Date.value || null,
    interview1_result: interview1Result.value,
    interview2_date: interview2Date.value || null,
    interview2_result: interview2Result.value,
    final_status: finalStatusInput.value
  }
}

jobForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!currentUser) return

  const rawLink = linkInput.value.trim()
  if (rawLink && !safeHttpUrl(rawLink)) {
    linkInput.setCustomValidity('http:// 또는 https:// 주소만 입력할 수 있습니다.')
    linkInput.reportValidity()
    return
  }
  linkInput.setCustomValidity('')

  setJobFormBusy(true)
  showAppMessage(editingId === null ? '기록을 저장하는 중입니다.' : '기록을 수정하는 중입니다.')

  let result
  if (editingId === null) {
    result = await supabaseClient
      .from('jobs')
      .insert({ ...getFormJobData(), user_id: currentUser.id })
      .select(DB_COLUMNS)
      .single()
  } else {
    result = await supabaseClient
      .from('jobs')
      .update(getFormJobData())
      .eq('id', editingId)
      .eq('user_id', currentUser.id)
      .select(DB_COLUMNS)
      .single()
  }

  setJobFormBusy(false)
  if (result.error) {
    showAppMessage('저장하지 못했습니다. 입력 내용과 인터넷 연결을 확인해 주세요.', true)
    return
  }

  const savedJob = fromDatabaseJob(result.data)
  const targetIndex = jobs.findIndex((job) => job.id === savedJob.id)
  if (targetIndex === -1) jobs.push(savedJob)
  else jobs[targetIndex] = savedJob

  renderJobs()
  resetForm()
  showAppMessage('안전하게 저장했습니다.')
})

function setJobFormBusy(isBusy) {
  submitButton.disabled = isBusy
  cancelEditButton.disabled = isBusy
}

function renderJobs() {
  const filteredJobs = getFilteredJobs()
  jobTableBody.replaceChildren()
  emptyMessage.hidden = filteredJobs.length > 0
  countText.textContent = filteredJobs.length === jobs.length
    ? `총 ${jobs.length}개 공고 관리 중`
    : `총 ${jobs.length}개 중 ${filteredJobs.length}개 표시`

  renderSummary()

  for (const job of filteredJobs) {
    jobTableBody.appendChild(createTableRow(job))
  }
}

function renderSummary() {
  const totalCount = jobs.length
  const preparedJobs = jobs.filter((job) => job.documentPrepared)
  const preparedCount = preparedJobs.length
  const waitingCount = preparedJobs.filter((job) => job.docStatus === '대기').length
  const decidedDocuments = preparedJobs.filter((job) => ['합격', '탈락'].includes(job.docStatus))
  const passedDocuments = decidedDocuments.filter((job) => job.docStatus === '합격').length
  const documentPassRate = percentage(passedDocuments, decidedDocuments.length)
  const interview1Count = preparedJobs.filter((job) => job.interview1Result === '대기').length
  const interview2Count = preparedJobs.filter((job) => job.interview2Result === '대기').length

  summaryTotal.textContent = `${totalCount}건`
  summaryPrepared.textContent = `${preparedCount} / ${totalCount}`
  summaryPreparedMeta.textContent = `${percentage(preparedCount, totalCount)}% 완료`
  summaryWaiting.textContent = `${waitingCount}건`
  summaryDocPassRate.textContent = `${documentPassRate}%`
  summaryDocPassMeta.textContent = decidedDocuments.length > 0
    ? `합격 ${passedDocuments} · 결과 ${decidedDocuments.length}`
    : '결과 0건'
  summaryInterview.textContent = `${interview1Count + interview2Count}건`
  summaryInterviewMeta.textContent = `1차 ${interview1Count} · 2차 ${interview2Count}`
}

function percentage(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

function getFilteredJobs() {
  const keyword = searchInput.value.trim().toLowerCase()
  const selectedStatus = statusFilter.value
  const selectedPrepared = preparedFilter.value

  return jobs
    .filter((job) => {
      const searchText = `${job.company} ${job.role}`.toLowerCase()
      const matchesStatus = selectedStatus === '전체' || job.finalStatus === selectedStatus
      const matchesPrepared = selectedPrepared === '전체'
        || (selectedPrepared === '작성완료' && job.documentPrepared)
        || (selectedPrepared === '미작성' && !job.documentPrepared)
      return searchText.includes(keyword) && matchesStatus && matchesPrepared
    })
    .sort(compareJobsByDeadline)
}

function compareJobsByDeadline(firstJob, secondJob) {
  const deadlineOrder = firstJob.date.localeCompare(secondJob.date)
  if (deadlineOrder !== 0) return deadlineOrder

  return String(firstJob.createdAt || '').localeCompare(String(secondJob.createdAt || ''))
}

function createTableRow(job) {
  const row = document.createElement('tr')
  row.className = job.documentPrepared ? 'is-prepared' : 'is-not-prepared'
  row.append(
    createDeadlineCell(job),
    createJobCell(job),
    createMaterialsCell(job),
    createProcessCell(job)
  )

  const actionsCell = document.createElement('td')
  actionsCell.className = 'table-actions'
  actionsCell.dataset.label = '관리'
  actionsCell.append(
    createButton('수정', 'edit-btn', () => startEdit(job.id)),
    createButton('삭제', 'delete-btn', () => void deleteJob(job.id))
  )
  row.appendChild(actionsCell)
  return row
}

function createDeadlineCell(job) {
  const cell = document.createElement('td')
  cell.className = 'deadline-cell'
  cell.dataset.label = '마감'

  const dDay = document.createElement('strong')
  dDay.className = 'td-dday'
  dDay.textContent = calculateDDay(job.date)

  const date = document.createElement('time')
  date.dateTime = job.date
  date.textContent = job.date
  cell.append(dDay, date)
  return cell
}

function createJobCell(job) {
  const cell = document.createElement('td')
  cell.className = 'job-cell'
  cell.dataset.label = '기업 / 직무'

  const company = document.createElement('strong')
  company.className = 'company-name'
  company.textContent = job.company

  const role = document.createElement('span')
  role.className = 'job-role'
  role.textContent = job.role

  const preparedLabel = document.createElement('label')
  preparedLabel.className = `prepared-toggle${job.documentPrepared ? ' is-complete' : ''}`

  const preparedCheckbox = document.createElement('input')
  preparedCheckbox.type = 'checkbox'
  preparedCheckbox.checked = job.documentPrepared
  preparedCheckbox.setAttribute('aria-label', `${job.company} 서류 작성 완료`)
  preparedCheckbox.addEventListener('change', () => {
    void updateDocumentPrepared(job, preparedCheckbox)
  })

  const preparedText = document.createElement('span')
  preparedText.textContent = job.documentPrepared ? '서류 작성 완료' : '서류 미작성'
  preparedLabel.append(preparedCheckbox, preparedText)
  cell.append(company, role, preparedLabel)
  return cell
}

async function updateDocumentPrepared(job, checkbox) {
  if (!currentUser) return
  const nextValue = checkbox.checked
  checkbox.disabled = true

  const { data, error } = await supabaseClient
    .from('jobs')
    .update({ document_prepared: nextValue })
    .eq('id', job.id)
    .eq('user_id', currentUser.id)
    .select('document_prepared, updated_at')
    .single()

  if (error) {
    checkbox.checked = job.documentPrepared
    checkbox.disabled = false
    showAppMessage('서류 작성 상태를 저장하지 못했습니다. 인터넷 연결과 DB 설정을 확인해 주세요.', true)
    return
  }

  job.documentPrepared = data.document_prepared === true
  job.updatedAt = data.updated_at
  renderJobs()
  showAppMessage(job.documentPrepared ? '서류 작성 완료로 저장했습니다.' : '서류 미작성으로 변경했습니다.')
}

function createMaterialsCell(job) {
  const cell = document.createElement('td')
  cell.className = 'materials-cell'
  cell.dataset.label = '지원 자료'

  appendMaterialLink(cell, job.link)
  appendMaterialButton(cell, job.jd, 'JD', 'jd-btn', () => {
    openModal(job.company, `${job.role} - 직무기술서(JD)`, job.jd)
  })
  appendMaterialButton(cell, job.preferred, '우대', 'pref-btn', () => {
    openModal(job.company, `${job.role} - 우대사항`, job.preferred)
  })
  appendMaterialButton(cell, job.coverLetter, '자소서', 'cl-btn', () => {
    openModal(job.company, `${job.role} - 자기소개서`, job.coverLetter)
  })
  return cell
}

function appendMaterialLink(cell, link) {
  const safeUrl = safeHttpUrl(link)
  if (!safeUrl) {
    cell.appendChild(createEmptyMaterial('채용'))
    return
  }

  const anchor = document.createElement('a')
  anchor.href = safeUrl
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.className = 'material-btn link-btn'
  anchor.textContent = '채용 ↗'
  cell.appendChild(anchor)
}

function appendMaterialButton(cell, value, label, extraClass, onClick) {
  if (!value) {
    cell.appendChild(createEmptyMaterial(label))
    return
  }

  cell.appendChild(createButton(label, `material-btn view-btn ${extraClass}`, onClick))
}

function createEmptyMaterial(label) {
  const empty = document.createElement('span')
  empty.className = 'material-btn material-empty'
  empty.textContent = label
  empty.title = `${label} 자료 없음`
  return empty
}

function createProcessCell(job) {
  const cell = document.createElement('td')
  cell.className = 'process-cell'
  cell.dataset.label = '전형 현황'

  const grid = document.createElement('div')
  grid.className = 'process-grid'
  appendProcessStage(grid, '서류', job.docStatus)
  appendProcessStage(grid, '1차', job.interview1Result, job.interview1Date)
  appendProcessStage(grid, '2차', job.interview2Result, job.interview2Date)
  appendProcessStage(grid, '최종', job.finalStatus)
  cell.appendChild(grid)
  return cell
}

function appendProcessStage(grid, label, status, dateValue = '') {
  const stage = document.createElement('div')
  stage.className = 'process-stage'

  const heading = document.createElement('div')
  heading.className = 'process-heading'
  const stageLabel = document.createElement('span')
  stageLabel.className = 'process-label'
  stageLabel.textContent = label
  heading.appendChild(stageLabel)

  if (dateValue) {
    const date = document.createElement('time')
    date.dateTime = dateValue
    date.textContent = dateValue.replaceAll('-', '.')
    date.title = dateValue
    heading.appendChild(date)
  }

  stage.append(heading, createStatusPill(status))
  grid.appendChild(stage)
}

function createStatusPill(status) {
  const pill = document.createElement('span')
  pill.className = `status-pill ${statusClassName(status)}`
  pill.textContent = status
  return pill
}

function statusClassName(status) {
  if (status === '합격' || status === '최종합격') return 'status-success'
  if (status === '탈락' || status === '최종탈락') return 'status-failure'
  if (status === '진행중') return 'status-progress'
  if (status === '미대상') return 'status-na'
  return 'status-waiting'
}

function createButton(label, className, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

function safeHttpUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function calculateDDay(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) return '-'
  const [year, month, day] = dateString.split('-').map(Number)
  const targetDate = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.round((targetDate - today) / 86400000)
  if (diffDays === 0) return 'D-Day'
  if (diffDays > 0) return `D-${diffDays}`
  return '마감'
}

function startEdit(id) {
  const target = jobs.find((job) => job.id === id)
  if (!target) return
  editingId = id

  companyInput.value = target.company
  roleInput.value = target.role
  dateInput.value = target.date
  documentPreparedInput.checked = target.documentPrepared
  linkInput.value = target.link
  jdInput.value = target.jd
  preferredInput.value = target.preferred
  coverLetterInput.value = target.coverLetter
  docStatusInput.value = target.docStatus
  interview1Date.value = target.interview1Date
  interview1Result.value = target.interview1Result
  interview2Date.value = target.interview2Date
  interview2Result.value = target.interview2Result
  finalStatusInput.value = target.finalStatus

  submitButton.textContent = '기록 수정완료'
  cancelEditButton.hidden = false
  companyInput.focus()
}

async function deleteJob(id) {
  if (!currentUser || !window.confirm('이 공채 프로세스 추적 데이터를 삭제하시겠습니까?')) return

  showAppMessage('기록을 삭제하는 중입니다.')
  const { error } = await supabaseClient
    .from('jobs')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id)

  if (error) {
    showAppMessage('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.', true)
    return
  }

  jobs = jobs.filter((job) => job.id !== id)
  if (editingId === id) resetForm()
  renderJobs()
  showAppMessage('삭제했습니다.')
}

function resetForm() {
  editingId = null
  jobForm.reset()
  linkInput.setCustomValidity('')
  submitButton.textContent = '등록하기'
  cancelEditButton.hidden = true
}

function openModal(company, titleSuffix, text) {
  modalTitle.textContent = `${company} - ${titleSuffix}`
  modalBodyText.textContent = text
  textModal.hidden = false
  closeModalBtn.focus()
}

function closeModal() {
  textModal.hidden = true
}

closeModalBtn.addEventListener('click', closeModal)
textModal.addEventListener('click', (event) => {
  if (event.target === textModal) closeModal()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !textModal.hidden) closeModal()
})

searchInput.addEventListener('input', renderJobs)
preparedFilter.addEventListener('change', renderJobs)
statusFilter.addEventListener('change', renderJobs)
cancelEditButton.addEventListener('click', resetForm)
linkInput.addEventListener('input', () => linkInput.setCustomValidity(''))

function readLegacyJobs() {
  let raw
  try {
    raw = localStorage.getItem(LEGACY_STORAGE_KEY)
  } catch {
    return { raw: '', jobs: [] }
  }
  if (!raw) return { raw: '', jobs: [] }

  try {
    const parsed = JSON.parse(raw)
    return { raw, jobs: Array.isArray(parsed) ? parsed : [] }
  } catch {
    return { raw, jobs: [] }
  }
}

async function refreshMigrationPanel() {
  const legacy = readLegacyJobs()
  migrationPanel.hidden = true
  if (legacy.jobs.length === 0 || !currentUser) return

  const { data: canImport, error } = await supabaseClient.rpc('can_import_legacy')
  if (error) {
    showAppMessage('기존 기록은 그대로 보존했습니다. Supabase의 이전 소유자 설정을 확인해 주세요.', true)
    return
  }

  if (!canImport) return
  legacyCount.textContent = `${legacy.jobs.length}개`
  migrationPanel.hidden = false
}

migrationButton.addEventListener('click', async () => {
  if (!currentUser) return

  const legacy = readLegacyJobs()
  if (legacy.jobs.length === 0) {
    migrationPanel.hidden = true
    return
  }

  const rows = legacy.jobs
    .map((job, index) => normalizeLegacyJob(job, index))
    .filter(Boolean)

  if (rows.length === 0) {
    showAppMessage('가져올 수 있는 유효한 기존 기록이 없습니다. 기존 데이터는 그대로 보존했습니다.', true)
    return
  }

  migrationButton.disabled = true
  showAppMessage(`${rows.length}개 기존 기록을 가져오는 중입니다.`)

  const { data: importedCount, error } = await supabaseClient
    .rpc('import_legacy_jobs', { payload: rows })

  migrationButton.disabled = false
  if (error) {
    showAppMessage('기존 기록을 가져오지 못했습니다. 로컬 데이터는 삭제하지 않았습니다.', true)
    return
  }

  moveLegacyDataToBackup(legacy.raw)
  migrationPanel.hidden = true
  const loaded = await loadJobs()
  if (loaded) {
    const skipped = legacy.jobs.length - rows.length
    showAppMessage(skipped > 0
      ? `${importedCount}개 기록을 가져왔고, 필수 정보가 없는 ${skipped}개는 로컬 백업에 보존했습니다.`
      : `${importedCount}개 기존 기록을 본인 계정으로 안전하게 가져왔습니다.`)
  }
})

function normalizeLegacyJob(job, index) {
  if (!job || typeof job !== 'object') return null

  const company = cleanText(job.company, 200).trim()
  const role = cleanText(job.role, 200).trim()
  const deadline = cleanText(job.date, 10)
  if (!company || !role || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null

  return {
    legacy_id: cleanText(job.id ?? `index-${index}`, 200),
    company,
    role,
    deadline,
    link: safeHttpUrl(cleanText(job.link, 2048)),
    jd: cleanText(job.jd, 50000),
    preferred: cleanText(job.preferred, 50000),
    cover_letter: cleanText(job.coverLetter, 200000),
    document_prepared: job.documentPrepared === true,
    doc_status: allowedValue(job.docStatus, DOC_STATUSES, '대기'),
    interview1_date: optionalDate(job.interview1Date),
    interview1_result: allowedValue(job.interview1Result, INTERVIEW_STATUSES, '미대상'),
    interview2_date: optionalDate(job.interview2Date),
    interview2_result: allowedValue(job.interview2Result, INTERVIEW_STATUSES, '미대상'),
    final_status: allowedValue(job.finalStatus, FINAL_STATUSES, '진행중')
  }
}

function cleanText(value, maxLength) {
  return String(value ?? '').slice(0, maxLength)
}

function allowedValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

function optionalDate(value) {
  const date = cleanText(value, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

function moveLegacyDataToBackup(raw) {
  if (!currentUser || !raw) return
  const backupKey = `${LEGACY_BACKUP_PREFIX}${currentUser.id}`

  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.setItem(backupKey, raw)
  } catch {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, raw)
    } catch {
      // DB 업로드는 이미 성공했으며, 브라우저 저장공간을 쓸 수 없는 상태입니다.
    }
  }
}

exportButton.addEventListener('click', () => {
  const exportJobs = jobs.map((job) => ({
    company: job.company,
    role: job.role,
    date: job.date,
    link: job.link,
    jd: job.jd,
    preferred: job.preferred,
    coverLetter: job.coverLetter,
    documentPrepared: job.documentPrepared,
    docStatus: job.docStatus,
    interview1Date: job.interview1Date,
    interview1Result: job.interview1Result,
    interview2Date: job.interview2Date,
    interview2Result: job.interview2Result,
    finalStatus: job.finalStatus
  }))

  const blob = new Blob([JSON.stringify(exportJobs, null, 2)], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  anchor.href = objectUrl
  anchor.download = `job-tracker-backup-${date}.json`
  anchor.click()
  URL.revokeObjectURL(objectUrl)
  showAppMessage('내 데이터 백업 파일을 저장했습니다.')
})

function showAppMessage(message, isError = false) {
  appMessage.textContent = message
  appMessage.hidden = !message
  appMessage.classList.toggle('error', isError)
}

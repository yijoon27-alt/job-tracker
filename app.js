import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js'

const LEGACY_STORAGE_KEY = 'excelJobs'
const LEGACY_BACKUP_PREFIX = 'excelJobsBackup:'
const DB_COLUMNS = 'id, company, role, deadline, deadline_time, link, jd, preferred, cover_letter, document_prepared, assessment_deadline, assessment_time, assessment_done, assessment_result, doc_status, interview1_date, interview1_result, interview2_date, interview2_result, final_status, created_at, updated_at'

const DOCUMENT_PREPARED_FLAG = {
  column: 'document_prepared',
  localKey: 'documentPrepared',
  onText: '서류 작성 완료로 저장했습니다.',
  offText: '서류 미작성으로 변경했습니다.',
  errorText: '서류 작성 상태를 저장하지 못했습니다. 인터넷 연결과 DB 설정을 확인해 주세요.'
}
const ASSESSMENT_DONE_FLAG = {
  column: 'assessment_done',
  localKey: 'assessmentDone',
  onText: '역량검사 응시 완료로 저장했습니다.',
  offText: '역량검사 미응시로 변경했습니다.',
  errorText: '역량검사 응시 상태를 저장하지 못했습니다. 인터넷 연결과 DB 설정을 확인해 주세요.'
}

const DOC_STATUSES = ['대기', '합격', '탈락']
const ASSESSMENT_RESULTS = ['대기', '합격', '탈락']
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

const jobFormPanel = document.querySelector('#jobFormPanel')
const formBackdrop = document.querySelector('#formBackdrop')
const formTitle = document.querySelector('#formTitle')
const openFormButton = document.querySelector('#openFormButton')
const closeFormButton = document.querySelector('#closeFormButton')
const jobForm = document.querySelector('#jobForm')
const companyInput = document.querySelector('#companyInput')
const roleInput = document.querySelector('#roleInput')
const dateInput = document.querySelector('#dateInput')
const deadlineTimeInput = document.querySelector('#deadlineTimeInput')
const documentPreparedInput = document.querySelector('#documentPreparedInput')
const assessmentDateInput = document.querySelector('#assessmentDateInput')
const assessmentTimeInput = document.querySelector('#assessmentTimeInput')
const assessmentDoneInput = document.querySelector('#assessmentDoneInput')
const assessmentResultRow = document.querySelector('#assessmentResultRow')
const assessmentResultInput = document.querySelector('#assessmentResultInput')
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
const summaryOngoing = document.querySelector('#summaryOngoing')
const summaryOngoingMeta = document.querySelector('#summaryOngoingMeta')
const summaryCards = document.querySelectorAll('[data-summary-filter]')

const timeInputs = [deadlineTimeInput, assessmentTimeInput]

const textModal = document.querySelector('#textModal')
const modalTitle = document.querySelector('#modalTitle')
const modalBodyText = document.querySelector('#modalBodyText')
const closeModalBtn = document.querySelector('#closeModalBtn')

let supabaseClient = null
let currentUser = null
let jobs = []
let editingId = null
let authViewVersion = 0
let formReturnFocus = null
let activeSummaryFilter = 'all'

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
    activeSummaryFilter = 'all'
    searchInput.value = ''
    preparedFilter.value = '전체'
    statusFilter.value = '전체'
    updateSummaryFilterUi()
    resetForm()
    closeJobForm({ restoreFocus: false })
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
    const schemaNeedsUpdate = String(error.message || '').includes('assessment_result')
    showAppMessage(schemaNeedsUpdate
      ? '최신 DB 업데이트가 필요합니다. Supabase SQL Editor에서 supabase-schema.sql 전체를 실행해 주세요.'
      : '데이터를 불러오지 못했습니다. Supabase SQL 설정과 인터넷 연결을 확인해 주세요.', true)
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
    deadlineTime: toTimeInputValue(row.deadline_time),
    link: row.link || '',
    jd: row.jd || '',
    preferred: row.preferred || '',
    coverLetter: row.cover_letter || '',
    documentPrepared: row.document_prepared === true,
    assessmentDate: row.assessment_deadline || '',
    assessmentTime: toTimeInputValue(row.assessment_time),
    assessmentDone: row.assessment_done === true,
    assessmentResult: allowedValue(row.assessment_result, ASSESSMENT_RESULTS, '대기'),
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
  const assessmentDate = assessmentDateInput.value
  const assessmentResult = allowedValue(assessmentResultInput.value, ASSESSMENT_RESULTS, '대기')

  return {
    company: companyInput.value.trim(),
    role: roleInput.value.trim(),
    deadline: dateInput.value,
    deadline_time: normalizeTimeText(deadlineTimeInput.value) || null,
    link: safeHttpUrl(linkInput.value.trim()),
    jd: jdInput.value,
    preferred: preferredInput.value,
    cover_letter: coverLetterInput.value,
    document_prepared: documentPreparedInput.checked,
    assessment_deadline: assessmentDate || null,
    assessment_time: assessmentDate ? normalizeTimeText(assessmentTimeInput.value) || null : null,
    assessment_done: assessmentDate
      ? assessmentDoneInput.checked || assessmentResult !== '대기'
      : false,
    assessment_result: assessmentDate ? assessmentResult : '대기',
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

  for (const timeInput of timeInputs) {
    if (normalizeTimeText(timeInput.value) !== null) {
      timeInput.setCustomValidity('')
      continue
    }
    timeInput.setCustomValidity('시각은 18:00 처럼 24시간제로 적어 주세요. 비워두어도 됩니다.')
    timeInput.reportValidity()
    return
  }

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
  closeJobForm()
  showAppMessage('안전하게 저장했습니다.')
})

function setJobFormBusy(isBusy) {
  submitButton.disabled = isBusy
  cancelEditButton.disabled = isBusy
  closeFormButton.disabled = isBusy
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
  const ongoingCount = jobs.filter((job) => (
    !isJobRejected(job)
    && job.finalStatus !== '최종합격'
    && isOngoingProcess(job)
  )).length

  summaryTotal.textContent = `${totalCount}건`
  summaryPrepared.textContent = `${preparedCount} / ${totalCount}`
  summaryPreparedMeta.textContent = `${percentage(preparedCount, totalCount)}% 완료`
  summaryWaiting.textContent = `${waitingCount}건`
  summaryDocPassRate.textContent = `${documentPassRate}%`
  summaryDocPassMeta.textContent = decidedDocuments.length > 0
    ? `합격 ${passedDocuments} · 결과 ${decidedDocuments.length}`
    : '결과 0건'
  summaryOngoing.textContent = `${ongoingCount}건`
  summaryOngoingMeta.textContent = '서류 합격 이후 기준'
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
      const matchesStatus = selectedStatus === '전체'
        || (selectedStatus === '진행중'
          && !isJobRejected(job)
          && job.finalStatus !== '최종합격'
          && isOngoingProcess(job))
        || (selectedStatus === '최종합격' && job.finalStatus === '최종합격')
        || (selectedStatus === '최종탈락' && isJobRejected(job))
      const matchesPrepared = selectedPrepared === '전체'
        || (selectedPrepared === '작성완료' && job.documentPrepared)
        || (selectedPrepared === '미작성' && !job.documentPrepared)
      return searchText.includes(keyword)
        && matchesStatus
        && matchesPrepared
        && matchesSummaryQuickFilter(job)
    })
    .sort(compareJobsByDeadline)
}

function matchesSummaryQuickFilter(job) {
  if (activeSummaryFilter === 'prepared') return job.documentPrepared
  if (activeSummaryFilter === 'document-waiting') return isDocumentResultWaiting(job)
  if (activeSummaryFilter === 'document-passed') return job.docStatus === '합격'
  if (activeSummaryFilter === 'ongoing') {
    return !isJobRejected(job)
      && job.finalStatus !== '최종합격'
      && isOngoingProcess(job)
  }
  return true
}

function compareJobsByDeadline(firstJob, secondJob) {
  const firstFinished = isJobRejected(firstJob) || firstJob.finalStatus === '최종합격'
  const secondFinished = isJobRejected(secondJob) || secondJob.finalStatus === '최종합격'
  if (firstFinished !== secondFinished) return firstFinished ? 1 : -1

  const firstPending = hasPendingWork(firstJob)
  const secondPending = hasPendingWork(secondJob)
  if (firstPending !== secondPending) return firstPending ? -1 : 1

  const firstOngoing = isOngoingProcess(firstJob)
  const secondOngoing = isOngoingProcess(secondJob)
  if (firstOngoing !== secondOngoing) return firstOngoing ? -1 : 1

  const first = nextDeadline(firstJob)
  const second = nextDeadline(secondJob)
  const firstClosed = isDeadlinePassed(first.date, first.time)
  const secondClosed = isDeadlinePassed(second.date, second.time)
  if (firstClosed !== secondClosed) return firstClosed ? 1 : -1

  const firstTimestamp = deadlineTimestamp(first.date, first.time)
  const secondTimestamp = deadlineTimestamp(second.date, second.time)
  const deadlineOrder = firstClosed
    ? secondTimestamp - firstTimestamp
    : firstTimestamp - secondTimestamp
  if (deadlineOrder !== 0) return deadlineOrder

  return String(firstJob.createdAt || '').localeCompare(String(secondJob.createdAt || ''))
}

function isAssessmentPending(job) {
  return Boolean(job.assessmentDate)
    && !job.assessmentDone
    && !isDeadlinePassed(job.assessmentDate, job.assessmentTime)
}

// 아직 손댈 일이 남은 공고인지. 마감이 이미 지난 미작성 공고는 할 일이 아니라 놓친 공고다.
function hasPendingWork(job) {
  if (!job.documentPrepared && !isDeadlinePassed(job.date, job.deadlineTime)) return true
  return isAssessmentPending(job)
}

// 서류 합격 또는 그 이후 전형에 진입한 공고인지.
// 서류 결과 대기와 지원서 작성 단계는 진행 중 공고 집계에서 제외한다.
function isOngoingProcess(job) {
  return job.docStatus === '합격'
    || job.assessmentResult === '합격'
    || ['대기', '합격'].includes(job.interview1Result)
    || ['대기', '합격'].includes(job.interview2Result)
}

// 정렬과 행 강조에 쓰는 '다음에 지켜야 할 마감'.
// 서류를 다 썼고 역량검사만 남았다면 서류 마감이 아니라 역량검사 마감이 기준이 된다.
function nextDeadline(job) {
  if (job.documentPrepared && isAssessmentPending(job)) {
    return { date: job.assessmentDate, time: job.assessmentTime }
  }
  return { date: job.date, time: job.deadlineTime }
}

function createTableRow(job) {
  const row = document.createElement('tr')
  const next = nextDeadline(job)
  row.classList.add(deadlineClassName(next.date, next.time))
  if (isDocumentResultWaiting(job)) row.classList.add('is-document-waiting')
  if (isJobRejected(job)) row.classList.add('is-rejected')
  row.append(
    createDeadlineCell(job),
    createJobCell(job),
    createPreparedCell(job),
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

function isDocumentResultWaiting(job) {
  return job.documentPrepared
    && job.docStatus === '대기'
    && !isJobRejected(job)
    && job.finalStatus !== '최종합격'
}

function createDeadlineCell(job) {
  const cell = document.createElement('td')
  cell.className = 'deadline-cell'
  cell.dataset.label = '서류 마감'

  const dDay = document.createElement('strong')
  dDay.className = 'td-dday'
  dDay.textContent = calculateDDay(job.date, job.deadlineTime)

  const date = document.createElement('time')
  date.dateTime = momentAttribute(job.date, job.deadlineTime)
  date.textContent = momentText(job.date, job.deadlineTime)
  cell.append(dDay, date)

  const assessment = createAssessmentBlock(job)
  if (assessment) cell.appendChild(assessment)
  return cell
}

function createAssessmentBlock(job) {
  if (!job.assessmentDate) return null

  const block = document.createElement('div')
  block.className = 'assessment-line'

  const badge = document.createElement('span')
  badge.className = `assessment-badge ${assessmentBadgeClassName(job)}`
  badge.textContent = assessmentBadgeText(job)

  const toggle = document.createElement('label')
  toggle.className = `prepared-toggle assessment-toggle${job.assessmentDone ? ' is-complete' : ''}`

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = job.assessmentDone
  checkbox.setAttribute('aria-label', `${job.company} AI 역량검사 응시 완료`)
  checkbox.addEventListener('change', () => {
    void updateJobFlag(job, ASSESSMENT_DONE_FLAG, checkbox)
  })

  const toggleText = document.createElement('span')
  toggleText.textContent = job.assessmentDone ? '응시 완료' : '미응시'
  toggle.append(checkbox, toggleText)

  const head = document.createElement('div')
  head.className = 'assessment-head'
  head.append(badge, toggle)

  const moment = document.createElement('time')
  moment.className = 'assessment-time'
  moment.dateTime = momentAttribute(job.assessmentDate, job.assessmentTime)
  moment.textContent = momentText(job.assessmentDate, job.assessmentTime)

  block.append(head, moment)
  return block
}

function assessmentBadgeText(job) {
  if (job.assessmentDone) return '검사 완료'
  if (isDeadlinePassed(job.assessmentDate, job.assessmentTime)) return '검사 마감'
  const diffDays = daysUntilDeadline(job.assessmentDate)
  if (diffDays === null) return '검사'
  return diffDays === 0 ? '검사 D-Day' : `검사 D-${diffDays}`
}

function assessmentBadgeClassName(job) {
  if (job.assessmentDone) return 'is-done'
  if (isDeadlinePassed(job.assessmentDate, job.assessmentTime)) return 'is-closed'
  const diffDays = daysUntilDeadline(job.assessmentDate)
  return diffDays !== null && diffDays <= 3 ? 'is-urgent' : 'is-open'
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

  cell.append(company, role)
  return cell
}

function createPreparedCell(job) {
  const cell = document.createElement('td')
  cell.className = 'prepared-cell'
  cell.dataset.label = '서류 작성'

  const preparedLabel = document.createElement('label')
  preparedLabel.className = `prepared-toggle${job.documentPrepared ? ' is-complete' : ''}`

  const preparedCheckbox = document.createElement('input')
  preparedCheckbox.type = 'checkbox'
  preparedCheckbox.checked = job.documentPrepared
  preparedCheckbox.setAttribute('aria-label', `${job.company} 서류 작성 완료`)
  preparedCheckbox.addEventListener('change', () => {
    void updateJobFlag(job, DOCUMENT_PREPARED_FLAG, preparedCheckbox)
  })

  const preparedText = document.createElement('span')
  preparedText.textContent = job.documentPrepared ? '작성 완료' : '미작성'
  preparedLabel.append(preparedCheckbox, preparedText)
  cell.appendChild(preparedLabel)
  return cell
}

async function updateJobFlag(job, flag, checkbox) {
  if (!currentUser) return
  const nextValue = checkbox.checked
  const updates = { [flag.column]: nextValue }
  let selectedColumns = `${flag.column}, updated_at`

  if (flag === ASSESSMENT_DONE_FLAG && !nextValue && job.assessmentResult !== '대기') {
    updates.assessment_result = '대기'
    selectedColumns = `${flag.column}, assessment_result, updated_at`
  }

  checkbox.disabled = true

  const { data, error } = await supabaseClient
    .from('jobs')
    .update(updates)
    .eq('id', job.id)
    .eq('user_id', currentUser.id)
    .select(selectedColumns)
    .single()

  if (error) {
    checkbox.checked = job[flag.localKey]
    checkbox.disabled = false
    showAppMessage(flag.errorText, true)
    return
  }

  job[flag.localKey] = data[flag.column] === true
  if (data.assessment_result) job.assessmentResult = data.assessment_result
  job.updatedAt = data.updated_at
  renderJobs()
  showAppMessage(job[flag.localKey] ? flag.onText : flag.offText)
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
  cell.dataset.label = '현재 전형'

  const current = getCurrentStage(job)
  const currentLabel = document.createElement('strong')
  currentLabel.className = `current-stage-label ${current.className}`
  currentLabel.textContent = current.label

  const currentHeader = document.createElement('div')
  currentHeader.className = 'current-stage-header'
  currentHeader.appendChild(currentLabel)

  const pendingResultConfig = getPendingResultConfig(job)
  const quickResultSelect = createQuickResultSelect(job, pendingResultConfig)
  if (quickResultSelect) currentHeader.appendChild(quickResultSelect)

  const timeline = document.createElement('div')
  timeline.className = 'stage-timeline'
  for (const stage of getDisplayStages(job)) {
    const opensResultPicker = pendingResultConfig?.timelineLabel === stage.label && quickResultSelect
      ? () => openQuickResultPicker(quickResultSelect)
      : null
    timeline.appendChild(createTimelineStep(stage, opensResultPicker))
  }

  cell.append(currentHeader, timeline)
  return cell
}

function createQuickResultSelect(job, resultConfig = getPendingResultConfig(job)) {
  if (!resultConfig) return null

  const select = document.createElement('select')
  select.className = 'quick-result-select'
  select.setAttribute('aria-label', `${job.company} ${resultConfig.label} 결과 입력`)

  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = '결과 입력'

  const passed = document.createElement('option')
  passed.value = resultConfig.passedValue
  passed.textContent = '✓ 합격'

  const failed = document.createElement('option')
  failed.value = resultConfig.failedValue
  failed.textContent = '✕ 탈락'

  select.append(placeholder, passed, failed)
  select.addEventListener('change', () => {
    if (!select.value) return
    void updateJobResult(job, resultConfig, select.value, select)
  })
  return select
}

function getPendingResultConfig(job) {
  if (isJobRejected(job) || job.finalStatus === '최종합격') return null

  if (job.documentPrepared && job.docStatus === '대기') {
    return {
      label: '서류',
      timelineLabel: '서류',
      column: 'doc_status',
      localKey: 'docStatus',
      passedValue: '합격',
      failedValue: '탈락'
    }
  }

  if (job.docStatus === '합격' && job.assessmentDate) {
    if (job.assessmentDone && job.assessmentResult === '대기') {
      return {
        label: 'AI 역검·인적성',
        timelineLabel: 'AI/인적성',
        column: 'assessment_result',
        localKey: 'assessmentResult',
        passedValue: '합격',
        failedValue: '탈락',
        marksAssessmentDone: true
      }
    }
    if (job.assessmentResult !== '합격') return null
  }

  if (job.interview2Result === '대기') {
    return {
      label: '2차 면접',
      timelineLabel: '2차',
      column: 'interview2_result',
      localKey: 'interview2Result',
      passedValue: '합격',
      failedValue: '탈락'
    }
  }

  if (job.interview2Result === '합격' && job.finalStatus === '진행중') {
    return {
      label: '최종 전형',
      timelineLabel: '최종',
      column: 'final_status',
      localKey: 'finalStatus',
      passedValue: '최종합격',
      failedValue: '최종탈락'
    }
  }

  if (job.interview1Result === '대기') {
    return {
      label: '1차 면접',
      timelineLabel: '1차',
      column: 'interview1_result',
      localKey: 'interview1Result',
      passedValue: '합격',
      failedValue: '탈락'
    }
  }

  return null
}

function openQuickResultPicker(select) {
  select.focus()
  try {
    if (typeof select.showPicker === 'function') select.showPicker()
    else select.click()
  } catch {
    // 브라우저가 프로그래밍 방식의 선택 메뉴 열기를 지원하지 않으면 포커스만 이동합니다.
  }
}

async function updateJobResult(job, resultConfig, selectedValue, select) {
  if (!currentUser) return

  if (selectedValue === resultConfig.failedValue) {
    const confirmed = window.confirm(`${job.company}의 ${resultConfig.label} 결과를 탈락으로 저장하시겠습니까?`)
    if (!confirmed) {
      select.value = ''
      return
    }
  }

  const updates = { [resultConfig.column]: selectedValue }
  const selectedColumns = [resultConfig.column]
  if (resultConfig.marksAssessmentDone) {
    updates.assessment_done = true
    selectedColumns.push('assessment_done')
  }
  selectedColumns.push('updated_at')

  select.disabled = true
  showAppMessage(`${resultConfig.label} 결과를 저장하는 중입니다.`)

  const { data, error } = await supabaseClient
    .from('jobs')
    .update(updates)
    .eq('id', job.id)
    .eq('user_id', currentUser.id)
    .select(selectedColumns.join(', '))
    .single()

  if (error) {
    select.value = ''
    select.disabled = false
    showAppMessage(`${resultConfig.label} 결과를 저장하지 못했습니다. 인터넷 연결과 DB 설정을 확인해 주세요.`, true)
    return
  }

  job[resultConfig.localKey] = data[resultConfig.column]
  if (resultConfig.marksAssessmentDone) job.assessmentDone = data.assessment_done === true
  job.updatedAt = data.updated_at
  renderJobs()
  showAppMessage(`${resultConfig.label} 결과를 ${selectedValue}으로 저장했습니다.`)
}

function getCurrentStage(job) {
  if (job.docStatus === '탈락') return { label: '서류 탈락 · 전형 종료', className: 'is-failure' }
  if (job.assessmentDate && job.assessmentResult === '탈락') {
    return { label: 'AI 역검·인적성 탈락 · 전형 종료', className: 'is-failure' }
  }
  if (job.interview1Result === '탈락') return { label: '1차 면접 탈락 · 전형 종료', className: 'is-failure' }
  if (job.interview2Result === '탈락') return { label: '2차 면접 탈락 · 전형 종료', className: 'is-failure' }
  if (job.finalStatus === '최종탈락') return { label: '최종 전형 탈락', className: 'is-failure' }
  if (job.finalStatus === '최종합격') return { label: '최종 합격', className: 'is-success' }
  if (job.docStatus === '합격' && job.assessmentDate && job.assessmentResult !== '합격') {
    if (job.assessmentDone) {
      return { label: 'AI 역검·인적성 결과 대기', className: 'is-waiting' }
    }
    if (isDeadlinePassed(job.assessmentDate, job.assessmentTime)) {
      return { label: 'AI 역검·인적성 마감 · 미응시', className: 'is-failure' }
    }
    return { label: stageWithDate('AI 역검·인적성 응시 대기', job.assessmentDate), className: 'is-progress' }
  }
  if (job.interview2Result === '대기') {
    return { label: stageWithDate('2차 면접 진행', job.interview2Date), className: 'is-progress' }
  }
  if (job.interview2Result === '합격') return { label: '최종 결과 대기', className: 'is-waiting' }
  if (job.interview1Result === '대기') {
    return { label: stageWithDate('1차 면접 진행', job.interview1Date), className: 'is-progress' }
  }
  if (job.interview1Result === '합격') return { label: '2차 면접 준비', className: 'is-progress' }
  if (job.docStatus === '합격') return { label: '1차 면접 준비', className: 'is-progress' }
  if (job.documentPrepared) return { label: '서류 결과 대기', className: 'is-waiting' }
  return { label: '지원서 작성 전', className: 'is-draft' }
}

function stageWithDate(label, dateValue) {
  return dateValue ? `${label} · ${dateValue.replaceAll('-', '.')}` : label
}

function getDisplayStages(job) {
  const stages = [
    { label: '서류', status: job.docStatus }
  ]

  if (job.assessmentDate) {
    stages.push({
      label: 'AI/인적성',
      status: assessmentStageStatus(job),
      date: job.assessmentDate,
      isAssessment: true
    })
  }

  stages.push(
    { label: '1차', status: normalizeInterviewStatus(job.interview1Result), date: job.interview1Date },
    { label: '2차', status: normalizeInterviewStatus(job.interview2Result), date: job.interview2Date },
    { label: '최종', status: normalizeFinalStatus(job) }
  )

  let followingStagesHidden = false
  return stages.map((stage) => {
    if (followingStagesHidden) {
      return { ...stage, status: '—', date: '' }
    }

    if (stage.status === '탈락' || stage.status === '최종탈락') {
      followingStagesHidden = true
    } else if (stage.isAssessment && stage.status !== '합격') {
      followingStagesHidden = true
    }
    return stage
  })
}

function assessmentStageStatus(job) {
  if (job.assessmentResult === '합격' || job.assessmentResult === '탈락') {
    return job.assessmentResult
  }
  if (job.assessmentDone) return '결과대기'
  if (isDeadlinePassed(job.assessmentDate, job.assessmentTime)) return '마감'
  return '미응시'
}

function normalizeInterviewStatus(status) {
  return status === '미대상' ? '—' : status
}

function normalizeFinalStatus(job) {
  if (job.finalStatus === '최종합격') return '합격'
  if (job.finalStatus === '최종탈락') return '탈락'
  return job.interview2Result === '합격' ? '대기' : '—'
}

function createTimelineStep(stage, onResultClick = null) {
  const step = document.createElement(onResultClick ? 'button' : 'span')
  step.className = `timeline-step ${statusClassName(stage.status)}${onResultClick ? ' is-actionable' : ''}`
  if (onResultClick) {
    step.type = 'button'
    step.title = `${stage.label} 결과 입력`
    step.setAttribute('aria-label', `${stage.label} 결과 입력 메뉴 열기`)
    step.addEventListener('click', onResultClick)
  }

  const label = document.createElement('b')
  label.textContent = stage.label
  const status = document.createElement('span')
  status.textContent = stage.status
  step.append(label, status)

  if (stage.date && stage.status !== '—') {
    const date = document.createElement('time')
    date.dateTime = stage.date
    date.textContent = stage.date.slice(5).replace('-', '.')
    date.title = stage.date
    step.appendChild(date)
  }

  return step
}

function statusClassName(status) {
  if (status === '합격' || status === '최종합격' || status === '완료') return 'status-success'
  if (status === '탈락' || status === '최종탈락' || status === '마감') return 'status-failure'
  if (status === '진행중') return 'status-progress'
  if (status === '미대상' || status === '—') return 'status-na'
  return 'status-waiting'
}

function isJobRejected(job) {
  return job.docStatus === '탈락'
    || (job.assessmentDate && job.assessmentResult === '탈락')
    || job.interview1Result === '탈락'
    || job.interview2Result === '탈락'
    || job.finalStatus === '최종탈락'
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

function calculateDDay(dateString, timeString) {
  const diffDays = daysUntilDeadline(dateString)
  if (diffDays === null) return '-'
  if (diffDays > 0) return `D-${diffDays}`
  if (diffDays === 0 && !isDeadlinePassed(dateString, timeString)) return 'D-Day'
  return '마감'
}

function toTimeInputValue(value) {
  const text = String(value ?? '')
  return /^\d{2}:\d{2}/.test(text) ? text.slice(0, 5) : ''
}

function momentText(dateString, timeString) {
  const time = toTimeInputValue(timeString)
  return time ? `${dateString} ${time}` : dateString
}

function momentAttribute(dateString, timeString) {
  const time = toTimeInputValue(timeString)
  return time ? `${dateString}T${time}` : dateString
}

function deadlineMoment(dateString, timeString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) return null
  const [year, month, day] = dateString.split('-').map(Number)
  const time = toTimeInputValue(timeString)
  const [hours, minutes] = time ? time.split(':').map(Number) : [23, 59]
  // 시각 미입력이면 그날 끝(23:59:59)까지 유효하다고 본다
  return new Date(year, month - 1, day, hours, minutes, time ? 0 : 59, 0)
}

function deadlineTimestamp(dateString, timeString) {
  return deadlineMoment(dateString, timeString)?.getTime() ?? Number.POSITIVE_INFINITY
}

function isDeadlinePassed(dateString, timeString) {
  const moment = deadlineMoment(dateString, timeString)
  return moment !== null && moment.getTime() < Date.now()
}

function daysUntilDeadline(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) return null
  const [year, month, day] = dateString.split('-').map(Number)
  const targetDate = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Math.round((targetDate - today) / 86400000)
}

function deadlineClassName(dateString, timeString) {
  const diffDays = daysUntilDeadline(dateString)
  if (diffDays === null || isDeadlinePassed(dateString, timeString)) return 'deadline-closed'
  if (diffDays <= 3) return 'deadline-urgent'
  if (diffDays <= 7) return 'deadline-soon'
  return 'deadline-open'
}

function startEdit(id) {
  const target = jobs.find((job) => job.id === id)
  if (!target) return
  editingId = id

  companyInput.value = target.company
  roleInput.value = target.role
  dateInput.value = target.date
  deadlineTimeInput.value = target.deadlineTime
  documentPreparedInput.checked = target.documentPrepared
  assessmentDateInput.value = target.assessmentDate
  assessmentTimeInput.value = target.assessmentTime
  assessmentDoneInput.checked = target.assessmentDone
  assessmentResultInput.value = target.assessmentResult
  syncAssessmentResultField()
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

  formTitle.textContent = `${target.company} 수정`
  submitButton.textContent = '기록 수정완료'
  cancelEditButton.hidden = false
  openJobForm()
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
  if (editingId === id) {
    resetForm()
    closeJobForm()
  }
  renderJobs()
  showAppMessage('삭제했습니다.')
}

function resetForm() {
  editingId = null
  jobForm.reset()
  syncAssessmentResultField()
  linkInput.setCustomValidity('')
  clearTimeValidity()
  submitButton.textContent = '등록하기'
  cancelEditButton.hidden = true
}

function openJobForm() {
  formReturnFocus = document.activeElement
  jobFormPanel.hidden = false
  formBackdrop.hidden = false
  openFormButton.setAttribute('aria-expanded', 'true')
  document.body.classList.add('drawer-open')
}

function openNewJobForm() {
  resetForm()
  formTitle.textContent = '지원 기업 등록'
  openJobForm()
  companyInput.focus()
}

function closeJobForm({ restoreFocus = true } = {}) {
  if (jobFormPanel.hidden && formBackdrop.hidden) return
  jobFormPanel.hidden = true
  formBackdrop.hidden = true
  openFormButton.setAttribute('aria-expanded', 'false')
  document.body.classList.remove('drawer-open')

  if (restoreFocus) {
    const focusTarget = formReturnFocus instanceof HTMLElement && formReturnFocus.isConnected
      ? formReturnFocus
      : openFormButton
    focusTarget.focus()
  }
  formReturnFocus = null
}

function cancelJobForm() {
  if (submitButton.disabled) return
  resetForm()
  closeJobForm()
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
  if (event.key !== 'Escape') return
  if (!textModal.hidden) closeModal()
  else if (!jobFormPanel.hidden) cancelJobForm()
})

searchInput.addEventListener('input', renderJobs)
preparedFilter.addEventListener('change', () => {
  clearSummaryQuickFilter()
  renderJobs()
})
statusFilter.addEventListener('change', () => {
  clearSummaryQuickFilter()
  renderJobs()
})
for (const card of summaryCards) {
  card.addEventListener('click', () => {
    const selectedFilter = card.dataset.summaryFilter
    activeSummaryFilter = activeSummaryFilter === selectedFilter && selectedFilter !== 'all'
      ? 'all'
      : selectedFilter
    searchInput.value = ''
    preparedFilter.value = '전체'
    statusFilter.value = '전체'
    updateSummaryFilterUi()
    renderJobs()
  })
}
openFormButton.addEventListener('click', openNewJobForm)
closeFormButton.addEventListener('click', cancelJobForm)
formBackdrop.addEventListener('click', cancelJobForm)
cancelEditButton.addEventListener('click', cancelJobForm)
linkInput.addEventListener('input', () => linkInput.setCustomValidity(''))

function clearSummaryQuickFilter() {
  activeSummaryFilter = ''
  updateSummaryFilterUi()
}

function updateSummaryFilterUi() {
  for (const card of summaryCards) {
    const isActive = card.dataset.summaryFilter === activeSummaryFilter
    card.classList.toggle('is-active', isActive)
    card.setAttribute('aria-pressed', String(isActive))
  }
}

// 시각은 브라우저 시간 위젯 대신 직접 입력받는다.
// 오전·오후 칸을 키보드로만 바꿀 수 있는 위젯 때문에 값이 만들어지지 않는 문제를 피한다.
// 빈 값은 '', 못 알아들은 값은 null, 알아들은 값은 'HH:MM'을 돌려준다.
function normalizeTimeText(value) {
  const raw = String(value ?? '')
    .replace(/[\uFF10-\uFF19]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
    .replace(/[:\uFF1A]/g, ':')
    .trim()
  if (!raw) return ''

  const isPm = /오후|p\.?m\.?/i.test(raw)
  const isAm = /오전|a\.?m\.?/i.test(raw)
  const text = raw.replace(/오전|오후|a\.?m\.?|p\.?m\.?|시|분/gi, '').replace(/\s+/g, '')

  let hours
  let minutes
  const colonMatch = text.match(/^(\d{1,2}):(\d{1,2})$/)
  if (colonMatch) {
    hours = Number(colonMatch[1])
    minutes = Number(colonMatch[2])
  } else if (/^\d{1,4}$/.test(text)) {
    hours = text.length <= 2 ? Number(text) : Number(text.slice(0, -2))
    minutes = text.length <= 2 ? 0 : Number(text.slice(-2))
  } else {
    return null
  }

  if (isPm && hours < 12) hours += 12
  if (isAm && hours === 12) hours = 0
  if (hours > 23 || minutes > 59) return null

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function clearTimeValidity() {
  for (const timeInput of timeInputs) timeInput.setCustomValidity('')
}

for (const timeInput of timeInputs) {
  timeInput.addEventListener('input', () => timeInput.setCustomValidity(''))
  timeInput.addEventListener('blur', () => {
    const normalized = normalizeTimeText(timeInput.value)
    if (normalized !== null) timeInput.value = normalized
    timeInput.setCustomValidity('')
  })
}

function syncAssessmentResultField({ clearWhenMissing = false } = {}) {
  const hasAssessment = Boolean(assessmentDateInput.value)
  assessmentResultRow.hidden = !hasAssessment
  assessmentResultInput.disabled = !hasAssessment

  if (!hasAssessment && clearWhenMissing) {
    assessmentTimeInput.value = ''
    assessmentDoneInput.checked = false
    assessmentResultInput.value = '대기'
  }
}

assessmentDateInput.addEventListener('input', () => {
  syncAssessmentResultField({ clearWhenMissing: true })
})

assessmentDoneInput.addEventListener('change', () => {
  if (!assessmentDoneInput.checked) assessmentResultInput.value = '대기'
})

assessmentResultInput.addEventListener('change', () => {
  if (assessmentResultInput.value !== '대기') assessmentDoneInput.checked = true
})

syncAssessmentResultField()

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
    deadlineTime: job.deadlineTime,
    link: job.link,
    jd: job.jd,
    preferred: job.preferred,
    coverLetter: job.coverLetter,
    documentPrepared: job.documentPrepared,
    assessmentDate: job.assessmentDate,
    assessmentTime: job.assessmentTime,
    assessmentDone: job.assessmentDone,
    assessmentResult: job.assessmentResult,
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

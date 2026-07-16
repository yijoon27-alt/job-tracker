// HTML 요소 바인딩
const jobForm = document.querySelector('#jobForm')
const companyInput = document.querySelector('#companyInput')
const roleInput = document.querySelector('#roleInput')
const dateInput = document.querySelector('#dateInput')
const linkInput = document.querySelector('#linkInput')
const jdInput = document.querySelector('#jdInput') // 📌 JD 입력 추가

const docStatusInput = document.querySelector('#docStatusInput')
const interview1Date = document.querySelector('#interview1Date')
const interview1Result = document.querySelector('#interview1Result')
const interview2Date = document.querySelector('#interview2Date')
const interview2Result = document.querySelector('#interview2Result')
const finalStatusInput = document.querySelector('#finalStatusInput')

const submitButton = document.querySelector('#submitButton')
const cancelEditButton = document.querySelector('#cancelEditButton')
const searchInput = document.querySelector('#searchInput')
const statusFilter = document.querySelector('#statusFilter')

const countText = document.querySelector('#countText')
const emptyMessage = document.querySelector('#emptyMessage')
const jobTableBody = document.querySelector('#jobTableBody')

// 📌 모달 관련 DOM 요소 바인딩
const jdModal = document.querySelector('#jdModal')
const jdModalTitle = document.querySelector('#jdModalTitle')
const jdModalBodyText = document.querySelector('#jdModalBodyText')
const closeJdModalBtn = document.querySelector('#closeJdModalBtn')

// 로컬스토리지 보관소 연동
let jobs = JSON.parse(localStorage.getItem('excelJobs')) || []
let editingId = null

// 초기화 가동
renderJobs()

function renderJobs() {
  const filteredJobs = getFilteredJobs()
  jobTableBody.innerHTML = ''
  
  emptyMessage.hidden = filteredJobs.length > 0
  countText.textContent = `총 ${jobs.length}개 기업 프로세스 추적 중`

  filteredJobs.forEach(function (job) {
    const row = createTableRow(job)
    jobTableBody.appendChild(row)
  })
}

function getFilteredJobs() {
  const keyword = searchInput.value.trim().toLowerCase()
  const selectedStatus = statusFilter.value

  return jobs.filter(function (job) {
    const searchText = `${job.company} ${job.role}`.toLowerCase()
    const matchKeyword = searchText.includes(keyword)
    const matchStatus = selectedStatus === '전체' || job.finalStatus === selectedStatus
    return matchKeyword && matchStatus
  })
}

// 엑셀 표의 행 생성
function createTableRow(job) {
  const tr = document.createElement('tr')

  const dDayText = calculateDDay(job.date)
  const int1DateText = job.interview1Date ? job.interview1Date : '-'
  const int2DateText = job.interview2Date ? job.interview2Date : '-'
  const linkCellContent = job.link ? `<a href="${job.link}" target="_blank" class="link-btn">이동</a>` : '-'
  
  // 📌 JD 유무에 따른 셀 노출 분기 (JD가 있을 때만 보기 버튼 제공)
  const jdCellContent = job.jd ? `<button class="jd-view-btn" type="button">JD 보기</button>` : '-'

  tr.innerHTML = `
    <td class="td-dday">${dDayText}</td>
    <td style="font-weight: 700;">${job.company}</td>
    <td>${job.role}</td>
    <td>${job.date}</td>
    <td><span class="status-pill ${job.docStatus}">${job.docStatus}</span></td>
    <td>${int1DateText}</td>
    <td><span class="status-pill ${job.interview1Result}">${job.interview1Result}</span></td>
    <td>${int2DateText}</td>
    <td><span class="status-pill ${job.interview2Result}">${job.interview2Result}</span></td>
    <td><span class="status-pill ${job.finalStatus}">${job.finalStatus}</span></td>
    <td>${linkCellContent}</td>
    <td>${jdCellContent}</td> <td class="table-actions">
      <button class="edit-btn">수정</button>
      <button class="delete-btn">삭제</button>
    </td>
  `

  // 이벤트 연결
  tr.querySelector('.edit-btn').addEventListener('click', () => startEdit(job.id))
  tr.querySelector('.delete-btn').addEventListener('click', () => deleteJob(job.id))
  
  if (job.jd) {
    tr.querySelector('.jd-view-btn').addEventListener('click', () => openJdModal(job.company, job.role, job.jd))
  }

  return tr
}

// 📌 JD 전용 팝업 모달창 열기
function openJdModal(company, role, jdText) {
  jdModalTitle.textContent = `${company} - ${role} 직무기술서`
  jdModalBodyText.textContent = jdText
  jdModal.removeAttribute('hidden')
}

// 📌 JD 팝업창 닫기
closeJdModalBtn.addEventListener('click', function () {
  jdModal.setAttribute('hidden', 'true')
})

// 외부 검은 투명 레이어 클릭 시에도 모달창 닫히도록 예외 처리
jdModal.addEventListener('click', function (event) {
  if (event.target === jdModal) {
    jdModal.setAttribute('hidden', 'true')
  }
})

function calculateDDay(targetDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0)
  
  const targetDate = new Date(targetDateStr);
  targetDate.setHours(0, 0, 0, 0)

  const diffTime = targetDate - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'D-Day'
  if (diffDays > 0) return `D-${diffDays}`
  return `마감`
}

function saveToLocalStorage() {
  localStorage.setItem('excelJobs', JSON.stringify(jobs))
}

jobForm.addEventListener('submit', function (event) {
  event.preventDefault()

  const company = companyInput.value.trim()
  const role = roleInput.value.trim()
  const date = dateInput.value
  const link = linkInput.value.trim()
  const jd = jdInput.value // 📌 JD 변수 바인딩
  
  const docStatus = docStatusInput.value
  const interview1D = interview1Date.value
  const interview1R = interview1Result.value
  const interview2D = interview2Date.value
  const interview2R = interview2Result.value
  const finalStatus = finalStatusInput.value

  const jobData = {
    company,
    role,
    date,
    link,
    jd, // 📌 JD 저장소 추가
    docStatus,
    interview1Date: interview1D,
    interview1Result: interview1R,
    interview2Date: interview2D,
    interview2Result: interview2R,
    finalStatus
  }

  if (editingId === null) {
    const newJob = { id: Date.now(), ...jobData }
    jobs.push(newJob)
  } else {
    const targetIndex = jobs.findIndex(job => job.id === editingId)
    if (targetIndex !== -1) {
      jobs[targetIndex] = { id: editingId, ...jobData }
    }
  }

  saveToLocalStorage()
  renderJobs()
  resetForm()
})

function startEdit(id) {
  const target = jobs.find(job => job.id === id)
  if (!target) return
  editingId = id

  companyInput.value = target.company
  roleInput.value = target.role
  dateInput.value = target.date
  linkInput.value = target.link
  jdInput.value = target.jd || "" // 📌 JD 불러오기 수정

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

function deleteJob(id) {
  if (confirm("이 공채 프로세스 추적 데이터를 삭제하시겠습니까?")) {
    jobs = jobs.filter(job => job.id !== id)
    saveToLocalStorage()
    renderJobs()
    if (editingId === id) resetForm()
  }
}

function resetForm() {
  editingId = null
  jobForm.reset()
  submitButton.textContent = '등록하기'
  cancelEditButton.hidden = true
  companyInput.focus()
}

searchInput.addEventListener('input', () => renderJobs())
statusFilter.addEventListener('change', () => renderJobs())
cancelEditButton.addEventListener('click', () => resetForm())
// HTML 요소 바인딩
const jobForm = document.querySelector('#jobForm')
const companyInput = document.querySelector('#companyInput')
const roleInput = document.querySelector('#roleInput')
const dateInput = document.querySelector('#dateInput')
const linkInput = document.querySelector('#linkInput')
const jdInput = document.querySelector('#jdInput')
const preferredInput = document.querySelector('#preferredInput') // 📌 우대사항 추가
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
const statusFilter = document.querySelector('#statusFilter')

const countText = document.querySelector('#countText')
const emptyMessage = document.querySelector('#emptyMessage')
const jobTableBody = document.querySelector('#jobTableBody')

// 모달 DOM 요소 바인딩
const textModal = document.querySelector('#textModal')
const modalTitle = document.querySelector('#modalTitle')
const modalBodyText = document.querySelector('#modalBodyText')
const closeModalBtn = document.querySelector('#closeModalBtn')

// 로컬스토리지 보관소 연동
let jobs = JSON.parse(localStorage.getItem('excelJobs')) || []
let editingId = null

// 초기 가동
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

// 엑셀 표 행 생성
function createTableRow(job) {
  const tr = document.createElement('tr')

  const dDayText = calculateDDay(job.date)
  const int1DateText = job.interview1Date ? job.interview1Date : '-'
  const int2DateText = job.interview2Date ? job.interview2Date : '-'
  const linkCellContent = job.link ? `<a href="${job.link}" target="_blank" class="link-btn">이동</a>` : '-'
  
  const jdCellContent = job.jd ? `<button class="view-btn" type="button">JD 보기</button>` : '-'
  // 📌 우대사항 셀 추가
  const prefCellContent = job.preferred ? `<button class="view-btn pref-btn" type="button">우대 보기</button>` : '-'
  const clCellContent = job.coverLetter ? `<button class="view-btn cl-btn" type="button">자소서 보기</button>` : '-'

  // 📌 가로축 정렬 순서 변경 (채용 상세 내용 선배치 ➡️ 전형 결과 후배치)
  tr.innerHTML = `
    <td class="td-dday">${dDayText}</td>
    <td style="font-weight: 700;">${job.company}</td>
    <td>${job.role}</td>
    <td>${job.date}</td>
    <td>${linkCellContent}</td>
    <td>${jdCellContent}</td>
    <td>${prefCellContent}</td> <!-- 📌 우대사항 선배치 -->
    <td>${clCellContent}</td>   <!-- 📌 자소서 선배치 -->
    <td><span class="status-pill ${job.docStatus}">${job.docStatus}</span></td>
    <td>${int1DateText}</td>
    <td><span class="status-pill ${job.interview1Result}">${job.interview1Result}</span></td>
    <td>${int2DateText}</td>
    <td><span class="status-pill ${job.interview2Result}">${job.interview2Result}</span></td>
    <td><span class="status-pill ${job.finalStatus}">${job.finalStatus}</span></td>
    <td class="table-actions">
      <button class="edit-btn">수정</button>
      <button class="delete-btn">삭제</button>
    </td>
  `

  // 이벤트 연결
  tr.querySelector('.edit-btn').addEventListener('click', () => startEdit(job.id))
  tr.querySelector('.delete-btn').addEventListener('click', () => deleteJob(job.id))
  
  if (job.jd) {
    tr.querySelectorAll('.view-btn')[0].addEventListener('click', () => openModal(job.company, `${job.role} - 직무기술서(JD)`, job.jd))
  }
  
  if (job.preferred) {
    // 버튼 인덱스를 고려하여 우대사항 바인딩
    const prefBtn = tr.querySelector('.pref-btn')
    if (prefBtn) {
      prefBtn.addEventListener('click', () => openModal(job.company, `${job.role} - 우대사항`, job.preferred))
    }
  }
  
  if (job.coverLetter) {
    const clBtn = tr.querySelector('.cl-btn')
    if (clBtn) {
      clBtn.addEventListener('click', () => openModal(job.company, `${job.role} - 자기소개서`, job.coverLetter))
    }
  }

  return tr
}

// 팝업 모달창 제어
function openModal(company, titleSuffix, text) {
  modalTitle.textContent = `${company} - ${titleSuffix}`
  modalBodyText.textContent = text
  textModal.removeAttribute('hidden')
}

closeModalBtn.addEventListener('click', function () {
  textModal.setAttribute('hidden', 'true')
})

textModal.addEventListener('click', function (event) {
  if (event.target === textModal) {
    textModal.setAttribute('hidden', 'true')
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
  const jd = jdInput.value
  const preferred = preferredInput.value // 📌 우대사항 파싱
  const coverLetter = coverLetterInput.value
  
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
    jd,
    preferred, // 📌 우대사항 추가
    coverLetter,
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
  jdInput.value = target.jd || ""
  preferredInput.value = target.preferred || "" // 📌 우대사항 리스토어
  coverLetterInput.value = target.coverLetter || ""

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
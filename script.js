const DB_KEY = 'college_assess_platform_v1';
function readDB(){try{return JSON.parse(localStorage.getItem(DB_KEY)||'{}')}catch(e){return{}}}
function writeDB(data){localStorage.setItem(DB_KEY,JSON.stringify(data))}
function ensureDB(){const db=readDB();db.exams=db.exams||[];db.attempts=db.attempts||[];writeDB(db);return db}

let state={user:null,role:null,currentExamId:null,examTimer:null}
ensureDB();

const loginView=document.getElementById('loginView');
const dashboardView=document.getElementById('dashboardView');
const examView=document.getElementById('examView');
const resultsView=document.getElementById('resultsView');
const userLabel=document.getElementById('userLabel');
const logoutBtn=document.getElementById('logoutBtn');

// Login forms
document.getElementById('studentForm').addEventListener('submit', e=>{
  e.preventDefault();
  const name=document.getElementById('studentName').value.trim();
  const roll=document.getElementById('studentRoll').value.trim();
  const err=document.getElementById('studentFormError');
  if(!name||!roll){err.textContent='Enter name and roll';return;}
  err.textContent='';
  state.user={name,roll};state.role='student';onLogin();
});

document.getElementById('instrForm').addEventListener('submit', e=>{
  e.preventDefault();
  const name=document.getElementById('instrName').value.trim();
  const err=document.getElementById('instrFormError');
  if(!name){err.textContent='Enter name';return;}
  err.textContent='';
  state.user={name};state.role='instructor';onLogin();
});

logoutBtn.addEventListener('click', ()=>{state={};renderLogin();localStorage.removeItem('currentUser')});

// Create exam
document.getElementById('createExamForm').addEventListener('submit', e=>{
  e.preventDefault();
  const title=document.getElementById('examTitle').value.trim();
  const duration=parseInt(document.getElementById('examDuration').value.trim(),10);
  let questionsJSON=document.getElementById('examQuestions').value.trim();
  const err=document.getElementById('examFormError');
  if(!title||!duration||!questionsJSON){err.textContent='Fill all fields';return;}
  let questions;
  try{questions=JSON.parse(questionsJSON)}catch(err2){err.textContent='Questions must be valid JSON';return;}
  err.textContent='';
  const db=ensureDB();
  const id='e_'+Date.now();
  db.exams.push({id,title,duration,questions,published:true,createdBy:state.user.name});
  writeDB(db);
  document.getElementById('examTitle').value='';
  document.getElementById('examDuration').value='';
  document.getElementById('examQuestions').value='';
  renderDashboard();
});

// Load sample questions
document.getElementById('loadSample').addEventListener('click', e=>{
  e.preventDefault();
  const sample=JSON.stringify([
    {q:'2 + 2 = ?',options:['1','2','3','4'],ans:3},
    {q:'Which is not a programming language?',options:['Python','HTML','Java','C++'],ans:1}
  ],null,2);
  document.getElementById('examQuestions').value=sample;
});

// Login handler
function onLogin(){localStorage.setItem('currentUser',JSON.stringify({user:state.user,role:state.role}));renderDashboard();}

// Render views
function renderLogin(){
  loginView.style.display='block';dashboardView.style.display='none';examView.style.display='none';resultsView.style.display='none';
  userLabel.textContent='Not logged in';logoutBtn.style.display='none';
}

function renderDashboard(){
  const db=ensureDB();
  loginView.style.display='none';dashboardView.style.display='block';examView.style.display='none';resultsView.style.display='none';
  document.getElementById('dashWelcome').textContent=state.role==='student'?`Hello ${state.user.name} (${state.user.roll})`:`Instructor: ${state.user.name}`;
  userLabel.textContent=state.role==='student'?`${state.user.name} — Student`:`${state.user.name} — Instructor`;
  logoutBtn.style.display='inline-block';
  document.getElementById('sideTitle').textContent=state.role==='student'?'Instructor Panel (hidden)':'Instructor Panel';
  
  const examList=document.getElementById('examList');examList.innerHTML='';
  db.exams.filter(e=>e.published).forEach(e=>{
    const div=document.createElement('div');div.className='exam-item';
    div.innerHTML=`<div><strong>${escapeHtml(e.title)}</strong><div class='muted small'>Duration ${e.duration} min — ${e.questions.length} Qs — by ${escapeHtml(e.createdBy||'unknown')}</div></div>`;
    const actions=document.createElement('div');
    
    if(state.role==='student'){
      const btn=document.createElement('button');btn.className='btn';btn.textContent='Take Exam';btn.onclick=()=>startExam(e.id);
      actions.appendChild(btn);
    }else{
      const viewBtn=document.createElement('button');viewBtn.className='btn ghost';viewBtn.textContent='View / Edit';viewBtn.onclick=()=>viewExamForInstructor(e.id);
      actions.appendChild(viewBtn);

      const delBtn=document.createElement('button');
      delBtn.className='btn danger';
      delBtn.style.marginLeft='6px';
      delBtn.textContent='Delete';
      delBtn.onclick=()=>{
        if(confirm('Are you sure you want to delete this exam?')){
          db.exams=db.exams.filter(ex=>ex.id!==e.id);
          db.attempts=db.attempts.filter(a=>a.examId!==e.id);
          writeDB(db);
          renderDashboard();
        }
      };
      actions.appendChild(delBtn);
    }
    
    div.appendChild(actions);examList.appendChild(div);
  });

  const attemptsList=document.getElementById('attemptsList');attemptsList.innerHTML='';
  db.attempts.filter(a=>state.role==='student'?a.studentRoll===state.user.roll:true).forEach(a=>{
    const div=document.createElement('div');div.className='exam-item';
    div.innerHTML=`<div><strong>${escapeHtml(a.title)}</strong><div class='muted small'>Score: ${a.score==null?'Not submitted':a.score+'/'+a.total}</div></div>`;
    const actions=document.createElement('div');
    const viewBtn=document.createElement('button');viewBtn.className='btn ghost';viewBtn.textContent='View';viewBtn.onclick=()=>viewAttempt(a.id);
    actions.appendChild(viewBtn);div.appendChild(actions);attemptsList.appendChild(div);
  });

  document.getElementById('createExamForm').style.display=state.role==='instructor'?'block':'none';
}

// Exam functions
function startExam(examId){
  const db=ensureDB();const exam=db.exams.find(x=>x.id===examId);
  if(!exam) return;
  state.currentExamId=examId;
  const attemptId='a_'+Date.now();
  const attempt={id:attemptId,examId:examId,title:exam.title,studentName:state.user.name,studentRoll:state.user.roll,startedAt:Date.now(),duration:exam.duration,answers:{},submitted:false,total:exam.questions.length};
  db.attempts.push(attempt);writeDB(db);
  renderExam(attemptId);
}

function renderExam(attemptId){
  const db=ensureDB();const attempt=db.attempts.find(a=>a.id===attemptId);const exam=db.exams.find(e=>e.id===attempt.examId);
  if(!attempt||!exam) return;
  loginView.style.display='none';dashboardView.style.display='none';examView.style.display='block';resultsView.style.display='none';

  document.getElementById('examTitleH').textContent=exam.title;
  document.getElementById('examMeta').textContent=`Questions: ${exam.questions.length} • Duration: ${exam.duration} min`;

  const saved=attempt.answers||{};const container=document.getElementById('questionsContainer');container.innerHTML='';
  exam.questions.forEach((q,idx)=>{
    const qDiv=document.createElement('div');qDiv.className='question card';
    qDiv.innerHTML=`<div><strong>Q${idx+1}.</strong> ${escapeHtml(q.q)}</div>`;
    const opts=document.createElement('div');opts.className='options';
    q.options.forEach((opt,optIdx)=>{
      const o=document.createElement('div');o.className='option';o.textContent=opt;o.dataset.q=idx;o.dataset.idx=optIdx;
      if(saved[idx]===optIdx)o.classList.add('selected');
      o.onclick=()=>{selectOption(attempt.id,idx,optIdx);Array.from(opts.children).forEach(c=>c.classList.remove('selected'));o.classList.add('selected');}
      opts.appendChild(o);
    });qDiv.appendChild(opts);container.appendChild(qDiv);
  });

  const endTime=attempt.startedAt+exam.duration*60*1000;
  if(state.examTimer) clearInterval(state.examTimer);
  function updateTimer(){
    const now=Date.now();
    const t=Math.max(0,endTime-now);
    const mm=Math.floor(t/60000);const ss=Math.floor((t%60000)/1000);
    document.getElementById('timeLeft').textContent=`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    if(t<=0){clearInterval(state.examTimer);autoSubmit(attempt.id);}
  }
  updateTimer();state.examTimer=setInterval(updateTimer,500);

  document.getElementById('saveProgress').onclick=()=>{saveAttempt(attempt.id)};
  document.getElementById('submitExam').onclick=()=>{finishAndGrade(attempt.id)};
}

function saveAttempt(attemptId){
  const db=ensureDB();const attempt=db.attempts.find(a=>a.id===attemptId);if(!attempt)return;
  writeDB(db);
}

function selectOption(attemptId,qIdx,optIdx){
  const db=ensureDB();const attempt=db.attempts.find(a=>a.id===attemptId);if(!attempt)return;
  attempt.answers[qIdx]=optIdx;writeDB(db);
}

function autoSubmit(attemptId){finishAndGrade(attemptId);}

function finishAndGrade(attemptId){
  const db=ensureDB();const attempt=db.attempts.find(a=>a.id===attemptId);if(!attempt)return;
  const exam=db.exams.find(e=>e.id===attempt.examId);if(!exam)return;
  let score=0;exam.questions.forEach((q,idx)=>{if(attempt.answers&&attempt.answers[idx]===q.ans)score++;});
  attempt.submitted=true;attempt.submittedAt=Date.now();attempt.score=score;writeDB(db);
  renderResults(attempt.id);
}

function renderResults(attemptId){
  const db=ensureDB();const attempt=db.attempts.find(a=>a.id===attemptId);const exam=db.exams.find(e=>e.id===attempt.examId);
  if(!attempt||!exam) return;
  loginView.style.display='none';dashboardView.style.display='none';examView.style.display='none';resultsView.style.display='block';
  document.getElementById('scoreBlock').textContent=`Score: ${attempt.score} / ${attempt.total}`;
  const det=document.getElementById('detailedResults');det.innerHTML='';
  exam.questions.forEach((q,idx)=>{
    const div=document.createElement('div');div.className='card';
    const selected=attempt.answers&&attempt.answers[idx]!=null?attempt.answers[idx]:null;
    div.innerHTML=`<div><strong>Q${idx+1}.</strong> ${escapeHtml(q.q)}</div><div class='muted small' style='margin-top:6px'>Your answer: ${selected==null?'No response':escapeHtml(q.options[selected])}<br> Correct: ${escapeHtml(q.options[q.ans])}</div>`;
    det.appendChild(div);
  });
  document.getElementById('summaryBox').innerHTML=`Attempted at: ${new Date(attempt.startedAt).toLocaleString()}<br>Submitted at: ${attempt.submittedAt?new Date(attempt.submittedAt).toLocaleString():'Not submitted'}`;
  document.getElementById('backToDash').onclick=()=>renderDashboard();
}

function viewAttempt(attemptId){renderResults(attemptId);}
function viewExamForInstructor(examId){const db=ensureDB();const ex=db.exams.find(e=>e.id===examId);if(!ex)return;console.log(ex);}
function escapeHtml(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

(function init(){
  const cu=localStorage.getItem('currentUser');
  if(cu){const parsed=JSON.parse(cu);state.user=parsed.user;state.role=parsed.role;renderDashboard();}else{renderLogin();}
})();

let currentStep = 1;

const subServicesData = {
  OB: {
    title: "OBSTETRICS AND GYNECOLOGY SERVICES LINK",
    subtitle: "(OB, GYNE, FAMILY PLANNING)",
    options: ["PRENATAL CONSULTATION", "GYNECOLOGY CHECKUP", "FAMILY PLANNING"]
  },
  IM: {
    title: "INTERNAL MEDICINE SERVICES LINK",
    subtitle: "(IM, DIABETES MELLITUS, CP CLEARANCE)",
    options: ["DIABETES MELLITUS", "CP CLEARANCE", "GENERAL IM CONSULTATIONS"]
  },
  PD: {
    title: "PEDIATRICS SERVICES LINK",
    subtitle: "(PEDIA, NEWBORN, SCHOOL CLEARANCE)",
    options: ["PEDIATRIC CONSULTATION", "NEWBORN CARE", "SCHOOL CLEARANCE"]
  },
  GS: {
    title: "GENERAL SURGERY LINK",
    subtitle: "(SURGICAL CONSULTATIONS)",
    options: ["SURGICAL CONSULTATION", "MINOR SURGICAL PROCEDURE", "POST-OPERATIVE CHECKUP"]
  },
  DS: {
    title: "DENTAL SERVICES LINK",
    subtitle: "(DENTAL CARE & CONSULTATIONS)",
    options: ["DENTAL CHECKUP & CLEANING", "TOOTH EXTRACTION", "ORAL CONSULTATION"]
  },
  SP: {
    title: "SUBSPECIALTY SERVICES LINK",
    subtitle: "(OPHTHAL, CARDIO, DERMA)",
    options: ["OPHTHALMOLOGY CONSULTATION", "CARDIOLOGY CHECKUP", "DERMATOLOGY CONSULTATION"]
  },
  US: {
    title: "ULTRASOUND SERVICES LINK",
    subtitle: "(IMAGING & ULTRASOUND)",
    options: ["PELVIC ULTRASOUND", "ABDOMINAL ULTRASOUND", "OB-GYNE ULTRASOUND"]
  },
  OS: {
    title: "OTHER SERVICES LINK",
    subtitle: "(MISCELLANEOUS & GENERAL CARE)",
    options: ["GENERAL HEALTH CHECKUP", "MEDICAL CERTIFICATE ISSUANCE", "LABORATORY CONSULTATION"]
  }
};

const doctorsData = {
  OB: ["Dr. Celestia Santos", "Dr. Mich Collins"],
  IM: ["Dr. Larry Ross"],
  PD: ["Dr. Rich Reyes", "Dr. Lara Williams"],
  GS: ["Dr. Daisy Diaz"],
  DS: ["Dr. Jay Maxwell", "Dr. Mark Smith"],
  SP: ["Dr. Sarah Lee"],
  US: ["Dr. Francis Garcia", "Dr. Elaine Sanchez"],
  OS: ["Dr. Juanito Martinez"]
};

let selectedCategoryCode = "IM";
let selectedCategoryName = "Internal Medicine Services (IM, Diabetes Mellitus, CP Clearance)";
let selectedSpecific = "GENERAL IM CONSULTATIONS";

const _now = new Date();
let currentCalDate = new Date(_now.getFullYear(), _now.getMonth(), 1);
let selectedDate = String(_now.getDate());
let selectedTime = "10:00 AM";
const isoOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const selectedISO = () => isoOf(currentCalDate.getFullYear(), currentCalDate.getMonth(), Number(selectedDate));
// "10:00 AM" -> "10:00AM - 11:00AM" (same format the My Appointment page uses)
function slotLabel(t) {
  const [hm, ap] = t.split(" "); let h = Number(hm.split(":")[0]);
  const next = h + 1, nextAp = (h === 11 && ap === "AM") ? "PM" : ap;
  return `${h}:00${ap} - ${next > 12 ? next - 12 : next}:00${nextAp}`;
}
let selectedDoctor = "";

// Is this date + time already booked? (any appointment that isn't cancelled)
function isTaken(iso, time) {
  const slot = slotLabel(time);
  return Auth.getAppointments().some((a) => a.status !== "Cancelled" && a.date === iso && a.time === slot);
}
// Grey out the times that are already booked on the selected date
function refreshTimes() {
  const iso = selectedISO();
  document.querySelectorAll(".time-btn").forEach((btn) => {
    const time = btn.textContent.trim();
    const taken = isTaken(iso, time);
    btn.disabled = taken;
    btn.classList.toggle("taken", taken);
    btn.title = taken ? "Already booked" : "";
    if (taken && btn.classList.contains("selected")) { btn.classList.remove("selected"); selectedTime = ""; }
  });
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const baseHeaders = [
  { title: "Book an Appointment", subtitle: "Select your preferred service to get started." },
  { title: "SELECT SPECIFIC APPOINTMENT TYPE", subtitle: "Choose your appointment variation." },
  { title: "Calendar & Doctor Selection", subtitle: "Choose your preferred schedule and available specialist." },
  { title: "Patient Information", subtitle: "Please fill out the form below with accurate details." },
  { title: "Review Details", subtitle: "Please review your appointment details carefully before confirming." }
];

function updateHeader() {
  if (currentStep === 2) {
    const data = subServicesData[selectedCategoryCode] || subServicesData['IM'];
    document.getElementById("header-title").innerText = data.title;
    document.getElementById("header-subtitle").innerText = data.subtitle;
  } else {
    const h = baseHeaders[currentStep - 1];
    document.getElementById("header-title").innerText = h.title;
    document.getElementById("header-subtitle").innerText = h.subtitle;
  }

  const progressPercent = ((currentStep - 1) / 4) * 100;
  document.getElementById("stepper-progress").style.width = progressPercent + "%";

  for (let i = 1; i <= 5; i++) {
    const dot = document.getElementById(`dot-${i}`);
    dot.innerHTML = "";
    if (i < currentStep) {
      dot.className = "step-dot completed";
      dot.innerHTML = "&#10003;";
    } else if (i === currentStep) {
      dot.className = "step-dot active";
    } else {
      dot.className = "step-dot";
    }
  }
}

function renderSubServices() {
  const container = document.getElementById("options-list-container");
  if (!container) return;
  
  container.innerHTML = "";

  const categoryData = subServicesData[selectedCategoryCode] || subServicesData['IM'];
  const options = categoryData.options;

  selectedSpecific = options[0];

  options.forEach((optText, index) => {
    const isSelected = index === 0;
    const optionBox = document.createElement("div");
    optionBox.className = `option-box ${isSelected ? 'selected' : ''}`;
    optionBox.onclick = function() { selectSpecificService(optText, this); };

    optionBox.innerHTML = `
      <span class="option-text">${optText}</span>
      <div class="radio-circle"></div>
    `;

    container.appendChild(optionBox);
  });
}

function updateDoctorDropdown() {
  const docSelect = document.getElementById("doctorSelect");
  if (!docSelect) return;

  docSelect.innerHTML = '<option selected disabled value="">Select a specialist</option>';
  
  const availableDoctors = doctorsData[selectedCategoryCode] || ["Celestia Santos"];
  
  availableDoctors.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc;
    opt.innerText = doc;
    docSelect.appendChild(opt);
  });

  selectedDoctor = "";
}

function showStep(step) {
  document.querySelectorAll(".step-section").forEach(sec => sec.classList.remove("active"));
  document.getElementById(`step-${step}`).classList.add("active");

  if (step === 2) {
    renderSubServices();
  }

  if (step === 3) {
    updateDoctorDropdown();
    refreshTimes();
  }

  if (step === 5) {
    document.getElementById("rev-category").innerText = selectedCategoryName.toUpperCase();
    document.getElementById("rev-specific").innerText = selectedSpecific.toUpperCase();
    
    const currMonthStr = monthNames[currentCalDate.getMonth()].toUpperCase();
    const currYearNum = currentCalDate.getFullYear();
    document.getElementById("rev-date").innerText = `${currMonthStr} ${selectedDate}, ${currYearNum}`;
    
    document.getElementById("rev-time").innerText = selectedTime.toUpperCase();
    document.getElementById("rev-doctor").innerText = selectedDoctor ? selectedDoctor.toUpperCase() : "N/A";
    
    const fn = document.getElementById("fn").value.trim();
    const mn = document.getElementById("mn").value.trim();
    const ln = document.getElementById("ln").value.trim();
    const suffix = document.getElementById("suffix").value.trim();
    
    const nameParts = [fn, mn, ln, suffix].filter(Boolean);
    const fullName = nameParts.join(" ").toUpperCase();
    
    document.getElementById("rev-name").innerText = fullName || "N/A";
    
    const rawDob = document.getElementById("dob").value;
    if (rawDob) {
      const [yyyy, mm, dd] = rawDob.split("-");
      document.getElementById("rev-dob").innerText = `${dd}-${mm}-${yyyy}`;
    } else {
      document.getElementById("rev-dob").innerText = "N/A";
    }

    document.getElementById("rev-sex").innerText = (document.getElementById("sex").value || "N/A").toUpperCase();
    document.getElementById("rev-phone").innerText = document.getElementById("phone").value.trim() || "N/A";
    document.getElementById("rev-email").innerText = document.getElementById("email").value.trim().toUpperCase() || "N/A";
  }

  updateHeader();
}

function isGibberish(str) {
  if (!str || str.length < 2) return true;
  
  const cleanStr = str.toLowerCase().replace(/[^a-z]/g, '');
  if (cleanStr.length < 2) return true;

  if (/[bcdfghjklmnpqrstvwxyz]{4,}/.test(cleanStr)) return true;
  if (!/[aeiouy]/.test(cleanStr)) return true;
  if (/(.)\1{2,}/.test(cleanStr)) return true;

  return false;
}

function nextStep() {
  if (currentStep === 3) {
    const docSelect = document.getElementById("doctorSelect");
    const docErr = document.getElementById("err-doctor");
    const fail = (msg) => { docErr.innerText = msg; docErr.classList.add("show"); };
    docErr.classList.remove("show");
    docSelect.classList.remove("error");
    if (!docSelect.value) {
      docSelect.classList.add("error");
      return fail("Please choose an available doctor.");
    }
    selectedDoctor = docSelect.value;
    if (selectedISO() < Auth.todayISO()) return fail("Please pick a date that is today or later.");
    if (!selectedTime) return fail("Please choose a time.");
    if (isTaken(selectedISO(), selectedTime)) {
      refreshTimes();
      return fail("That date and time is already booked. Please choose another time.");
    }
  }

  if (currentStep === 4) {
    const fnInput = document.getElementById("fn");
    const lnInput = document.getElementById("ln");
    const dobInput = document.getElementById("dob");
    const sexInput = document.getElementById("sex");
    const phoneInput = document.getElementById("phone");
    const emailInput = document.getElementById("email");

    const fn = fnInput.value.trim();
    const ln = lnInput.value.trim();
    const dob = dobInput.value.trim();
    const sex = sexInput.value;
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();

    let isValid = true;

    [fnInput, lnInput, dobInput, sexInput, phoneInput, emailInput].forEach(el => el.classList.remove("error"));
    document.querySelectorAll(".error-msg").forEach(el => el.classList.remove("show"));

    if (!fn || isGibberish(fn)) {
      fnInput.classList.add("error");
      const err = document.getElementById("err-fn");
      err.innerText = "Please enter a valid first name.";
      err.classList.add("show");
      isValid = false;
    }
    if (!ln || isGibberish(ln)) {
      lnInput.classList.add("error");
      const err = document.getElementById("err-ln");
      err.innerText = "Please enter a valid last name.";
      err.classList.add("show");
      isValid = false;
    }
    if (!dob) {
      dobInput.classList.add("error");
      document.getElementById("err-dob").classList.add("show");
      isValid = false;
    }
    if (!sex) {
      sexInput.classList.add("error");
      document.getElementById("err-sex").classList.add("show");
      isValid = false;
    }

    const phoneRegex = /^(09|\+639)\d{9}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const isPhoneValid = phoneRegex.test(phone);
    const isEmailValid = emailRegex.test(email);

    if (!isPhoneValid && !isEmailValid) {
      if (phone) phoneInput.classList.add("error");
      if (email) emailInput.classList.add("error");
      
      const errContact = document.getElementById("err-contact");
      errContact.innerText = "Please provide either a valid phone number (09XXXXXXXXX) or a valid email address.";
      errContact.classList.add("show");
      isValid = false;
    }

    if (!isValid) return;
  }

  if (currentStep < 5) {
    currentStep++;
    showStep(currentStep);
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
  }
}

function selectServiceCategory(code, name, el) {
  document.querySelectorAll(".service-card").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  selectedCategoryCode = code;
  selectedCategoryName = name;
}

function selectSpecificService(name, el) {
  document.querySelectorAll(".option-box").forEach(b => b.classList.remove("selected"));
  el.classList.add("selected");
  selectedSpecific = name;
}

function selectTime(time, el) {
  document.querySelectorAll(".time-btn").forEach(b => b.classList.remove("selected"));
  el.classList.add("selected");
  selectedTime = time;
  document.getElementById("err-doctor").classList.remove("show");
}

function renderCalendar() {
  const grid = document.getElementById("calendar-days");
  const monthTitle = document.getElementById("cal-month-title");
  if (!grid || !monthTitle) return;
  
  grid.innerHTML = "";

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();

  monthTitle.innerText = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day-cell empty";
    grid.appendChild(emptyCell);
  }

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dayCell = document.createElement("div");
    dayCell.className = "day-cell";
    
    if (day.toString() === selectedDate && month === currentCalDate.getMonth()) {
      dayCell.classList.add("selected");
    }
    
    dayCell.innerText = day;
    if (isoOf(year, month, day) < Auth.todayISO()) {
      dayCell.classList.add("past");
      dayCell.classList.remove("selected");
      grid.appendChild(dayCell);
      continue;
    }
    dayCell.onclick = function(e) {
      e.preventDefault();
      document.querySelectorAll(".day-cell").forEach(c => c.classList.remove("selected"));
      this.classList.add("selected");
      selectedDate = day.toString();
      refreshTimes();
      document.getElementById("err-doctor").classList.remove("show");
    };
    
    grid.appendChild(dayCell);
  }
}

function changeMonth(direction) {
  currentCalDate.setMonth(currentCalDate.getMonth() + direction);
  renderCalendar();
  refreshTimes();
}

let submitting = false;
function submitForm() {
  if (submitting) return;
  if (isTaken(selectedISO(), selectedTime)) {          // booked meanwhile (e.g. in another tab)
    currentStep = 3; showStep(3);
    const e = document.getElementById("err-doctor");
    e.innerText = "That date and time is already booked. Please choose another time."; e.classList.add("show");
    return;
  }
  submitting = true;
  const list = Auth.getAppointments();
  const nextId = list.reduce((n, a) => Math.max(n, a.id), 0) + 1;
  const val = (id) => document.getElementById(id).value.trim();
  list.push({
    id: nextId,
    doctor: ({ "Dr. Celestia Santos": "celestia", "Dr. Rich Reyes": "rich", "Dr. Mich Collins": "mich" })[selectedDoctor] || "",
    doctorName: selectedDoctor,
    spec: (subServicesData[selectedCategoryCode] || {}).subtitle ? subServicesData[selectedCategoryCode].subtitle.replace(/[()]/g, "").split(",")[0].trim() : "",
    service: selectedCategoryName,
    specific: selectedSpecific,
    status: "Confirmed",
    date: selectedISO(),
    time: slotLabel(selectedTime),
    patient: { first: val("fn"), middle: val("mn"), last: val("ln"), suffix: val("suffix"), dob: val("dob"), sex: val("sex"), phone: val("phone"), email: val("email") }
  });
  Auth.saveAppointments(list);
  location.href = "appointments.html?booked=1";
}

renderCalendar();
refreshTimes();

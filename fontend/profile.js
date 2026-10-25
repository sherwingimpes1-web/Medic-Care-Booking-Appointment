document.addEventListener("DOMContentLoaded", () => {
  const daySelect = document.getElementById("bdayDay");
  const yearSelect = document.getElementById("bdayYear");
  const fullNameInput = document.getElementById("fullName");
  const emailInput = document.getElementById("email");
  const avatarInitials = document.getElementById("avatarInitials");
  const userDetailsForm = document.getElementById("userDetailsForm");
  
  const formView = document.getElementById("formView");
  const successView = document.getElementById("successView");
  const backToEditBtn = document.getElementById("backToEditBtn");

  // Sidebar (markup + open/close live in auth.js, same as every other page)
  Auth.initSidebar();
  const sidebarInitials = document.getElementById("sideAvatar");
  const sidebarName = document.getElementById("sideName");
  const sidebarEmail = document.getElementById("sideEmail");
  const setSideInitials = (v) => { if (!sidebarInitials.querySelector("img")) sidebarInitials.textContent = v; };

  function updateInitials(name) {
    if (!name || !name.trim()) {
      avatarInitials.innerText = "--";
      setSideInitials("--");
      return;
    }
    const words = name.trim().split(/\s+/);
    let initials = "";
    if (words.length === 1) {
      initials = words[0].substring(0, 2).toUpperCase();
    } else {
      initials = (words[0][0] + words[1][0]).toUpperCase();
    }
    avatarInitials.innerText = initials;
    setSideInitials(initials);
  }

  if (fullNameInput) {
    fullNameInput.addEventListener("input", (e) => {
      updateInitials(e.target.value);
      sidebarName.innerText = e.target.value.trim() || "User Name";
    });
  }

  if (emailInput) {
    emailInput.addEventListener("input", (e) => {
      sidebarEmail.innerText = e.target.value.trim() || "user@email.com";
    });
  }

  if (daySelect) {
    for (let d = 1; d <= 31; d++) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.innerText = d;
      daySelect.appendChild(opt);
    }
  }

  if (yearSelect) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1940; y--) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.innerText = y;
      yearSelect.appendChild(opt);
    }
  }

  function loadUserProfile() {
    const acct = Auth.profile();
    let extra = Auth.getData("profileExtra", {}) || {};
    const savedUser = {
      ...extra,
      fullName: acct.name,
      email: acct.email,
      phone: acct.phone
    };

    if (savedUser.fullName) {
      fullNameInput.value = savedUser.fullName;
      sidebarName.innerText = savedUser.fullName;
      updateInitials(savedUser.fullName);
    }
    if (savedUser.email) {
      emailInput.value = savedUser.email;
      sidebarEmail.innerText = savedUser.email;
    }
    if (savedUser.phone) document.getElementById("phone").value = savedUser.phone;
    if (savedUser.altPhone) document.getElementById("altPhone").value = savedUser.altPhone;
    if (savedUser.address) document.getElementById("address").value = savedUser.address;
    if (savedUser.sex) document.getElementById("sex").value = savedUser.sex;
    if (savedUser.bdayMonth) document.getElementById("bdayMonth").value = savedUser.bdayMonth;
    if (savedUser.bdayDay) document.getElementById("bdayDay").value = savedUser.bdayDay;
    if (savedUser.bdayYear) document.getElementById("bdayYear").value = savedUser.bdayYear;
  }

  loadUserProfile();

  // Save Form Handler
  if (userDetailsForm) {
    userDetailsForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const updatedUser = {
        fullName: fullNameInput.value.trim(),
        email: emailInput.value.trim(),
        phone: document.getElementById("phone").value.trim(),
        altPhone: document.getElementById("altPhone").value.trim(),
        address: document.getElementById("address").value.trim(),
        sex: document.getElementById("sex").value,
        bdayMonth: document.getElementById("bdayMonth").value,
        bdayDay: document.getElementById("bdayDay").value,
        bdayYear: document.getElementById("bdayYear").value
      };

      // name / email / phone live in the account so every page's sidebar stays in sync
      Auth.saveProfile({ name: updatedUser.fullName, email: updatedUser.email, phone: updatedUser.phone });
      Auth.setData("profileExtra", {
        altPhone: updatedUser.altPhone, address: updatedUser.address, sex: updatedUser.sex,
        bdayMonth: updatedUser.bdayMonth, bdayDay: updatedUser.bdayDay, bdayYear: updatedUser.bdayYear
      });
      
      // Palitan ang view patungong success screen
      formView.style.display = "none";
      successView.style.display = "flex";
    });
  }

  // Back to Edit View
  if (backToEditBtn) {
    backToEditBtn.addEventListener("click", () => {
      successView.style.display = "none";
      formView.style.display = "block";
    });
  }
});

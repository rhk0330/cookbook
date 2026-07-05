import { allergenDictionary } from "@shared/dictionaries";
import type {
  AccentColor,
  Difficulty,
  LanguageCode,
  MainProtein,
  MealType
} from "@shared/types";

export interface UiText {
  appTitle: string;
  languageLabel: string;
  languageEnglish: string;
  languageKorean: string;
  welcomeMessages: string[];
  searchPlaceholder: string;
  searchAria: string;
  newRecipe: string;
  recipeGrid: string;
  globalSettings: string;
  unitSystem: string;
  unitMetric: string;
  unitImperial: string;
  theme: string;
  lightMode: string;
  darkMode: string;
  accentColor: string;
  defaultUnit: string;
  rememberedUnit: string;
  customUnits: string;
  customUnitPlaceholder: string;
  noCustomUnits: string;
  removeUnit: string;
  removedUnits: string;
  restoreUnit: string;
  wifiSharing: string;
  wifiSharingOn: string;
  wifiSharingOff: string;
  wifiSharingUrl: string;
  wifiFriendlyUrl: string;
  wifiFriendlyHelp: string;
  wifiIpAddress: string;
  wifiPort: string;
  wifiQrCode: string;
  wifiWarning: string;
  wifiStableIpHelp: string;
  wifiUnavailable: string;
  wifiRefresh: string;
  copyAddress: string;
  accentLabels: Record<AccentColor, string>;
  searchResults: string;
  viewRecipes: string;
  recipeEyebrow: string;
  cookbookEyebrow: string;
  recipesTitle: string;
  editRecipe: string;
  untitledRecipe: string;
  edit: string;
  save: string;
  close: string;
  delete: string;
  exportRecipePdf: string;
  printRecipePdf: string;
  editOnPhone: string;
  editOnPhoneHelp: string;
  saveBeforeRemotePhotos: string;
  tileSize: string;
  filters: string;
  filterIngredients: string;
  filterIngredientPlaceholder: string;
  filterMaxSpice: string;
  filterMaxTime: string;
  filterDifficulty: string;
  filterAllergen: string;
  filterEquipment: string;
  clearFilters: string;
  any: string;
  exportBackup: string;
  importBackup: string;
  recipeSummary: string;
  time: string;
  spicy: string;
  spiceLevel: string;
  difficulty: string;
  mealType: string;
  mainProtein: string;
  prepAhead: string;
  ingredients: string;
  allergens: string;
  equipment: string;
  equipmentName: string;
  equipmentSize: string;
  equipmentSizeLabels: {
    small: string;
    medium: string;
    large: string;
  };
  recipe: string;
  notes: string;
  notesPlaceholder: string;
  none: string;
  noAllergens: string;
  chooseImage: string;
  coverPhotos: string;
  makePrimaryPhoto: string;
  removePhoto: string;
  addPhotos: string;
  openPhotos: string;
  previousPhoto: string;
  nextPhoto: string;
  findImage: string;
  searchingImages: string;
  pixabayProvider: string;
  pixabayResults: string;
  pixabaySearchPlaceholder: string;
  pixabaySearchButton: string;
  pixabayEmptyPrompt: string;
  pixabayAttribution: string;
  title: string;
  titlePlaceholder: string;
  cookTime: string;
  allergensPlaceholder: string;
  add: string;
  ingredientEmoji: string;
  emojiPickerTitle: string;
  emojiSearchPlaceholder: string;
  noEmojiResults: string;
  recentEmojis: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  removeIngredient: string;
  removeEquipment: string;
  removeStep: string;
  stepPlaceholder: string;
  openRecipe: (title: string) => string;
  noCover: (title: string) => string;
  confirmDelete: (title: string) => string;
  columns: (count: number) => string;
  minutesNone: string;
  minutes: (minutes: number) => string;
  hours: (hours: number) => string;
  hoursMinutes: (hours: number, minutes: number) => string;
  difficultyLabels: Record<Difficulty, string>;
  mealTypeLabels: Record<MealType, string>;
  mainProteinLabels: Record<MainProtein, string>;
  prepAheadLabels: {
    yes: string;
    no: string;
  };
  status: {
    recipeNotFound: string;
    newRecipe: string;
    saved: string;
    deleted: string;
    imageAdded: string;
    pixabayNoResults: string;
    pixabaySearchFailed: string;
    pixabayImportFailed: string;
    backupSaved: string;
    backupCanceled: string;
    backupImported: string;
    pdfSaved: string;
    pdfCanceled: string;
    pdfPrinted: string;
    pdfPrintCanceled: string;
    pdfFailed: string;
    titleRequired: string;
    ingredientRequired: string;
    stepRequired: string;
    validationFailed: string;
  };
}

export const uiText: Record<LanguageCode, UiText> = {
  ko: {
    appTitle: "Korean Cookbook",
    languageLabel: "언어",
    languageEnglish: "English",
    languageKorean: "한국어",
    welcomeMessages: [
      "오늘은 뭘 맛있게 만들어 볼까요!",
      "다시 오신 걸 환영해요, 셰프님!",
      "맛있는 한 끼를 시작해 볼까요!",
      "냉장고 속 재료가 멋진 요리가 돼요!",
      "오늘의 레시피를 찾아볼 시간이에요!",
      "한국의 맛을 집에서 즐겨봐요!",
      "작은 주방에서 큰 맛을 만들어봐요!",
      "따뜻한 한 그릇이 기다리고 있어요!",
      "새로운 최애 레시피를 발견해봐요!",
      "검색하고, 만들고, 맛있게 즐겨요!",
      "오늘도 맛있는 기록을 남겨봐요!",
      "요리할 준비가 됐어요!",
      "한식 한 접시로 하루를 밝혀봐요!",
      "함께 맛있는 메뉴를 골라봐요!",
      "지금 바로 맛있는 아이디어를 찾아봐요!"
    ],
    searchPlaceholder: "제목이나 재료로 검색",
    searchAria: "레시피 제목 또는 재료 검색",
    newRecipe: "새 레시피",
    recipeGrid: "레시피 그리드",
    globalSettings: "설정",
    unitSystem: "단위 체계",
    unitMetric: "미터법",
    unitImperial: "야드파운드법",
    theme: "화면 모드",
    lightMode: "라이트",
    darkMode: "다크",
    accentColor: "강조 색상",
    defaultUnit: "기본 재료 단위",
    rememberedUnit: "새 재료를 추가할 때 이 단위를 자동으로 넣습니다.",
    customUnits: "사용자 단위",
    customUnitPlaceholder: "사용자 단위 입력",
    noCustomUnits: "추가한 사용자 단위가 없습니다.",
    removeUnit: "단위 삭제",
    removedUnits: "숨긴 단위",
    restoreUnit: "단위 복원",
    wifiSharing: "Wi-Fi 공유",
    wifiSharingOn: "켜기",
    wifiSharingOff: "끄기",
    wifiSharingUrl: "접속 주소",
    wifiFriendlyUrl: "쉬운 주소",
    wifiFriendlyHelp: "기기나 공유기가 지원하지 않으면 위 숫자 IP 주소를 사용하세요.",
    wifiIpAddress: "PC Wi-Fi IP",
    wifiPort: "포트",
    wifiQrCode: "QR 코드",
    wifiWarning: "암호가 꺼져 있어 같은 Wi-Fi의 모든 기기가 레시피를 보고 편집할 수 있습니다.",
    wifiStableIpHelp: "항상 같은 주소를 쓰려면 공유기 설정에서 이 PC의 IP 예약을 켜세요.",
    wifiUnavailable: "Wi-Fi 공유를 켜면 주소와 QR 코드가 여기에 표시됩니다.",
    wifiRefresh: "새로고침",
    copyAddress: "주소 복사",
    accentLabels: {
      blue: "블루",
      green: "그린",
      red: "레드",
      yellow: "옐로"
    },
    searchResults: "검색 결과",
    viewRecipes: "Recipes 보기",
    recipeEyebrow: "Recipe",
    cookbookEyebrow: "Cookbook",
    recipesTitle: "Recipes",
    editRecipe: "레시피 편집",
    untitledRecipe: "새 레시피",
    edit: "편집",
    save: "저장",
    close: "닫기",
    delete: "삭제",
    exportRecipePdf: "PDF 내보내기",
    printRecipePdf: "PDF 인쇄",
    editOnPhone: "휴대폰에서 편집",
    editOnPhoneHelp: "같은 Wi-Fi의 휴대폰으로 이 QR 코드를 스캔하면 현재 레시피 편집 화면이 열립니다.",
    saveBeforeRemotePhotos: "다른 기기에서 사진을 추가하려면 먼저 이 레시피를 저장하세요.",
    tileSize: "타일 크기",
    filters: "필터",
    filterIngredients: "재료 조합",
    filterIngredientPlaceholder: "김치, 두부",
    filterMaxSpice: "최대 맵기",
    filterMaxTime: "최대 시간",
    filterDifficulty: "난이도",
    filterAllergen: "알레르기",
    filterEquipment: "도구",
    clearFilters: "필터 지우기",
    any: "전체",
    exportBackup: "백업 저장",
    importBackup: "백업 가져오기",
    recipeSummary: "레시피 요약",
    time: "시간",
    spicy: "맵기",
    spiceLevel: "맵기 단계",
    difficulty: "난이도",
    mealType: "식사 종류",
    mainProtein: "주 단백질",
    prepAhead: "미리 준비",
    ingredients: "재료",
    allergens: "알레르기",
    equipment: "도구",
    equipmentName: "도구명",
    equipmentSize: "크기",
    equipmentSizeLabels: {
      small: "소형",
      medium: "중형",
      large: "대형"
    },
    recipe: "레시피",
    notes: "노트",
    notesPlaceholder: "조리 팁, 다음에 바꿀 점, 가족 취향 등을 적어두세요.",
    none: "없음",
    noAllergens: "알레르기 없음",
    chooseImage: "이미지 선택",
    coverPhotos: "표지 사진",
    makePrimaryPhoto: "대표 사진으로 설정",
    removePhoto: "사진 삭제",
    addPhotos: "사진 추가",
    openPhotos: "사진 크게 보기",
    previousPhoto: "이전 사진",
    nextPhoto: "다음 사진",
    findImage: "이미지 찾기",
    searchingImages: "검색 중",
    pixabayProvider: "Pixabay",
    pixabayResults: "이미지 선택",
    pixabaySearchPlaceholder: "이미지 검색어 입력",
    pixabaySearchButton: "검색",
    pixabayEmptyPrompt: "검색어를 입력하고 상위 5개 이미지를 찾아보세요.",
    pixabayAttribution: "Pixabay 검색 결과입니다. 선택한 이미지는 로컬에 저장됩니다.",
    title: "제목",
    titlePlaceholder: "레시피 제목 입력",
    cookTime: "조리시간",
    allergensPlaceholder: "계란, 대두, wheat",
    add: "추가",
    ingredientEmoji: "재료 이모지",
    emojiPickerTitle: "이모지 선택",
    emojiSearchPlaceholder: "이모지 검색",
    noEmojiResults: "맞는 이모지가 없습니다.",
    recentEmojis: "최근 사용",
    ingredientName: "재료명",
    quantity: "양",
    unit: "단위",
    removeIngredient: "재료 삭제",
    removeEquipment: "도구 삭제",
    removeStep: "단계 삭제",
    stepPlaceholder: "조리 과정을 입력하세요",
    openRecipe: (title) => `${title} 열기`,
    noCover: (title) => `${title} 표지 없음`,
    confirmDelete: (title) => `${title} 레시피를 삭제할까요?`,
    columns: (count) => `${count}`,
    minutesNone: "시간 없음",
    minutes: (minutes) => `${minutes}분`,
    hours: (hours) => `${hours}시간`,
    hoursMinutes: (hours, minutes) => `${hours}시간 ${minutes}분`,
    difficultyLabels: {
      easy: "쉬움",
      medium: "보통",
      hard: "어려움"
    },
    mealTypeLabels: {
      breakfast: "아침",
      lunch: "점심",
      dinner: "저녁",
      side: "반찬",
      soup: "국/찌개",
      snack: "간식",
      dessert: "디저트",
      other: "기타"
    },
    mainProteinLabels: {
      beef: "소고기",
      pork: "돼지고기",
      chicken: "닭고기",
      seafood: "해산물",
      fish: "생선",
      tofu: "두부",
      egg: "계란",
      vegetable: "채소",
      none: "없음",
      other: "기타"
    },
    prepAheadLabels: {
      yes: "가능",
      no: "아니요"
    },
    status: {
      recipeNotFound: "레시피를 찾을 수 없습니다.",
      newRecipe: "새 레시피 작성 중",
      saved: "저장되었습니다.",
      deleted: "삭제되었습니다.",
      imageAdded: "표지 이미지가 추가되었습니다.",
      pixabayNoResults: "Pixabay에서 이미지를 찾지 못했습니다.",
      pixabaySearchFailed: "Pixabay 이미지 검색에 실패했습니다.",
      pixabayImportFailed: "Pixabay 이미지를 저장하지 못했습니다.",
      backupSaved: "백업을 저장했습니다.",
      backupCanceled: "백업이 취소되었습니다.",
      backupImported: "백업을 가져왔습니다.",
      pdfSaved: "PDF를 저장했습니다.",
      pdfCanceled: "PDF 저장이 취소되었습니다.",
      pdfPrinted: "인쇄를 보냈습니다.",
      pdfPrintCanceled: "인쇄가 취소되었습니다.",
      pdfFailed: "PDF를 만들지 못했습니다.",
      titleRequired: "레시피 제목을 입력해 주세요.",
      ingredientRequired: "재료를 한 가지 이상 입력해 주세요.",
      stepRequired: "조리 과정을 한 단계 이상 입력해 주세요.",
      validationFailed: "입력 내용을 확인해 주세요."
    }
  },
  en: {
    appTitle: "Korean Cookbook",
    languageLabel: "Language",
    languageEnglish: "English",
    languageKorean: "한국어",
    welcomeMessages: [
      "What should we cook today!",
      "Welcome back, chef!",
      "Let's make something delicious!",
      "Your next favorite recipe starts here!",
      "Time to turn ingredients into magic!",
      "Find a recipe and fire up the kitchen!",
      "Let's make dinner feel special!",
      "A great meal is waiting!",
      "Search, cook, and enjoy!",
      "Bring a Korean classic to life!",
      "Let's build your perfect cookbook!",
      "Pick a dish and let's get cooking!",
      "Small kitchen, big flavor!",
      "Your recipe collection is ready!",
      "Let's make something worth sharing!"
    ],
    searchPlaceholder: "Search by title or ingredient",
    searchAria: "Search recipe titles or ingredients",
    newRecipe: "New recipe",
    recipeGrid: "Recipe grid",
    globalSettings: "Settings",
    unitSystem: "Units",
    unitMetric: "Metric",
    unitImperial: "Imperial",
    theme: "Theme",
    lightMode: "Light",
    darkMode: "Dark",
    accentColor: "Accent color",
    defaultUnit: "Default ingredient unit",
    rememberedUnit: "New ingredients will start with this unit.",
    customUnits: "Custom units",
    customUnitPlaceholder: "Enter a custom unit",
    noCustomUnits: "No custom units yet.",
    removeUnit: "Remove unit",
    removedUnits: "Hidden units",
    restoreUnit: "Restore unit",
    wifiSharing: "Wi-Fi sharing",
    wifiSharingOn: "On",
    wifiSharingOff: "Off",
    wifiSharingUrl: "Access URL",
    wifiFriendlyUrl: "Friendly URL",
    wifiFriendlyHelp: "If your device or router does not support it, use the numeric IP address above.",
    wifiIpAddress: "PC Wi-Fi IP",
    wifiPort: "Port",
    wifiQrCode: "QR code",
    wifiWarning: "No password is enabled, so any device on this Wi-Fi can view and edit recipes.",
    wifiStableIpHelp: "For a truly stable address, reserve this PC's IP in your router settings.",
    wifiUnavailable: "Turn on Wi-Fi sharing to show the address and QR code here.",
    wifiRefresh: "Refresh",
    copyAddress: "Copy address",
    accentLabels: {
      blue: "Blue",
      green: "Green",
      red: "Red",
      yellow: "Yellow"
    },
    searchResults: "Search results",
    viewRecipes: "View recipes",
    recipeEyebrow: "Recipe",
    cookbookEyebrow: "Cookbook",
    recipesTitle: "Recipes",
    editRecipe: "Edit recipe",
    untitledRecipe: "New recipe",
    edit: "Edit",
    save: "Save",
    close: "Close",
    delete: "Delete",
    exportRecipePdf: "Export PDF",
    printRecipePdf: "Print PDF",
    editOnPhone: "Edit on phone",
    editOnPhoneHelp: "Scan this QR code on the same Wi-Fi to open this recipe directly in edit mode.",
    saveBeforeRemotePhotos: "Save this recipe before adding photos from another device.",
    tileSize: "Tile size",
    filters: "Filters",
    filterIngredients: "Ingredient combo",
    filterIngredientPlaceholder: "kimchi, tofu",
    filterMaxSpice: "Max spice",
    filterMaxTime: "Max time",
    filterDifficulty: "Difficulty",
    filterAllergen: "Allergen",
    filterEquipment: "Equipment",
    clearFilters: "Clear filters",
    any: "Any",
    exportBackup: "Export backup",
    importBackup: "Import backup",
    recipeSummary: "Recipe summary",
    time: "Time",
    spicy: "Spice",
    spiceLevel: "Spice level",
    difficulty: "Difficulty",
    mealType: "Meal type",
    mainProtein: "Main protein",
    prepAhead: "Prep ahead",
    ingredients: "Ingredients",
    allergens: "Allergens",
    equipment: "Equipment",
    equipmentName: "Equipment name",
    equipmentSize: "Size",
    equipmentSizeLabels: {
      small: "Small",
      medium: "Medium",
      large: "Large"
    },
    recipe: "Recipe",
    notes: "Notes",
    notesPlaceholder: "Add cooking notes, changes for next time, or preferences.",
    none: "None",
    noAllergens: "No allergens",
    chooseImage: "Choose image",
    coverPhotos: "Cover photos",
    makePrimaryPhoto: "Make primary photo",
    removePhoto: "Remove photo",
    addPhotos: "Add photos",
    openPhotos: "Open photos",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    findImage: "Find image",
    searchingImages: "Searching",
    pixabayProvider: "Pixabay",
    pixabayResults: "Choose image",
    pixabaySearchPlaceholder: "Search for an image",
    pixabaySearchButton: "Search",
    pixabayEmptyPrompt: "Enter a search term to show the top 5 images.",
    pixabayAttribution: "Pixabay search results. Selected images are saved locally.",
    title: "Title",
    titlePlaceholder: "Enter a recipe title",
    cookTime: "Cook time",
    allergensPlaceholder: "egg, soy, wheat",
    add: "Add",
    ingredientEmoji: "Ingredient emoji",
    emojiPickerTitle: "Choose emoji",
    emojiSearchPlaceholder: "Search emoji",
    noEmojiResults: "No emoji found.",
    recentEmojis: "Recently used",
    ingredientName: "Ingredient name",
    quantity: "Amount",
    unit: "Unit",
    removeIngredient: "Remove ingredient",
    removeEquipment: "Remove equipment",
    removeStep: "Remove step",
    stepPlaceholder: "Enter a cooking step",
    openRecipe: (title) => `Open ${title}`,
    noCover: (title) => `No cover for ${title}`,
    confirmDelete: (title) => `Delete the recipe "${title}"?`,
    columns: (count) => `${count}`,
    minutesNone: "No time",
    minutes: (minutes) => `${minutes} min`,
    hours: (hours) => `${hours} hr`,
    hoursMinutes: (hours, minutes) => `${hours} hr ${minutes} min`,
    difficultyLabels: {
      easy: "Easy",
      medium: "Medium",
      hard: "Hard"
    },
    mealTypeLabels: {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      side: "Side dish",
      soup: "Soup/stew",
      snack: "Snack",
      dessert: "Dessert",
      other: "Other"
    },
    mainProteinLabels: {
      beef: "Beef",
      pork: "Pork",
      chicken: "Chicken",
      seafood: "Seafood",
      fish: "Fish",
      tofu: "Tofu",
      egg: "Egg",
      vegetable: "Vegetable",
      none: "None",
      other: "Other"
    },
    prepAheadLabels: {
      yes: "Yes",
      no: "No"
    },
    status: {
      recipeNotFound: "Recipe not found.",
      newRecipe: "Creating a new recipe",
      saved: "Saved.",
      deleted: "Deleted.",
      imageAdded: "Cover image added.",
      pixabayNoResults: "No Pixabay images found.",
      pixabaySearchFailed: "Could not search Pixabay images.",
      pixabayImportFailed: "Could not save the Pixabay image.",
      backupSaved: "Backup saved.",
      backupCanceled: "Backup canceled.",
      backupImported: "Backup imported.",
      pdfSaved: "PDF saved.",
      pdfCanceled: "PDF export canceled.",
      pdfPrinted: "Sent to printer.",
      pdfPrintCanceled: "Print canceled.",
      pdfFailed: "Could not create the PDF.",
      titleRequired: "Enter a recipe title.",
      ingredientRequired: "Add at least one ingredient.",
      stepRequired: "Add at least one cooking step.",
      validationFailed: "Check the recipe details."
    }
  }
};

export function getAllergenLabel(id: string, language: LanguageCode): string {
  const allergen = allergenDictionary.find((entry) => entry.id === id);
  if (!allergen) {
    return id;
  }

  return language === "ko" ? allergen.labelKo : allergen.labelEn;
}

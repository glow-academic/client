// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 62,
    "userId": 63,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 86,
    "scope": "scope_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 66,
    "userId": 89,
    "expires": "2025-07-18T19:29:39.397Z"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 50,
    "name": "Admin User",
    "email": "admin@example.com"
  },
  {
    "id": 28,
    "name": "Instructional User",
    "emailVerified": "2025-07-18T19:29:39.397Z"
  },
  {
    "id": 29,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-07-18T19:29:39.397Z"
  },
  {
    "id": 66,
    "email": "ta@example.com",
    "emailVerified": "2025-07-18T19:29:39.397Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "oxlpvsyt-py41-9xc0-1fqv-ixdqjwfqx2j",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "userId": 50,
    "lastLogin": "2025-07-18T19:29:39.397Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "role": "admin",
    "active": true
  },
  {
    "id": "hyvs3ti7-sm7t-yc7u-prkm-g2x1gj0958t",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "userId": 28,
    "lastLogin": "2025-07-18T19:29:39.397Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "role": "instructional",
    "active": false
  },
  {
    "id": "ktaq60jy-1qck-7vzo-er8t-zcwxe0shgtf",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "userId": 29,
    "lastLogin": "2025-07-18T19:29:39.397Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "role": "instructor",
    "active": false
  },
  {
    "id": "me73bej8-3477-3d8w-obbd-85s0iw2nrhu",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "userId": 66,
    "lastLogin": "2025-07-18T19:29:39.397Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "role": "ta",
    "active": false
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "2j1rmwu9-rl8l-6fvt-4754-nzfh7y8qxdp",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// DEPARTMENTS MOCK DATA
export const departments = [
  {
    "id": "9a74hxq8-ls1o-jfus-2rts-rry1iqxw21k",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "departmentCode": "departmentCode_1",
    "name": "Departments 1",
    "description": "Description for departments 1"
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "8uaqg3vm-1qfp-x5gd-j3qe-jw19mhsqitl",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "departmentId": "departmentId_1",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "7egmqrmb-ifb2-45t8-c71z-tooa8b75f98",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "departmentId": "departmentId_2",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "r41prqzo-j3mg-ryhi-v7kj-5jbp07q534h",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1"
  }
];

// LOCATIONS MOCK DATA
export const locations = [
  {
    "id": "6ymnidrx-f8um-pcqv-mzrt-gz9mzsvee9r",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Locations 1",
    "description": "Description for locations 1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "q9e3s5rm-808s-vsqc-fajz-mmom2ysa6x",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "5srj0ch6-n34e-a4wk-xar5-ohpq8hsrbql",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 11,
    "passPoints": "passPoints_1"
  },
  {
    "id": "44yrvpyf-733d-1mu4-rt6o-4q1zyn6kbt2",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 93,
    "passPoints": "passPoints_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "hzn0euys-dycy-xynt-mlaq-kmp2ruf5h4m",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 88,
    "passPoints": "passPoints_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "ysv3un2e-ree8-k96p-qqe2-j7daiv9hcoq",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 61
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 31,
    "level": "level_1",
    "message": "message_1",
    "context": {}
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 26,
    "createdAt": "2025-07-18T19:29:39.397Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "bs3xfyej-c95r-psom-mar9-nk8qm0vvf7p",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "i138jd12-gok7-0jro-8ok8-qmzrhnltdfj",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1"
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "q227dupd-qt0k-bqhi-hfha-qkj1i1xvjri",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "completedAt": "2025-07-18T19:29:39.397Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1"
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "1vevupee-cl4z-yi05-apea-vgfy05hlrw9",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "lsfr4zzu-vefs-300w-wkct-sqnsfwwzypq",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "headerComponentIds": [
      "headerComponentIds_1"
    ],
    "primaryComponentIds": [
      "primaryComponentIds_1"
    ],
    "secondaryComponentIds": [
      "secondaryComponentIds_1"
    ],
    "footerComponentIds": [
      "footerComponentIds_1"
    ],
    "autoScroll": "autoScroll_1",
    "showIndicators": "showIndicators_1",
    "headerComponents": "headerComponents_1",
    "mainSplit": "mainSplit_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "el5oqemi-3643-0lq5-s2kb-qm1wpnc9ik",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.3,
    "defaultAgent": "defaultAgent_1",
    "editable": true,
    "modelId": "modelId_1"
  },
  {
    "id": "aikxkgdt-kub2-lba0-0sr4-0licyixr9jx",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.51,
    "defaultAgent": "defaultAgent_2",
    "editable": false,
    "modelId": "modelId_2"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "wj3hx53n-iou4-0w5r-xz8k-js8hzppldi",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "crowdedness": 87,
    "locationId": "locationId_1",
    "deadlineId": "deadlineId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true
  },
  {
    "id": "hddsgrc4-639a-zp6x-ehe7-xq3pzb1v5rg",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "classId": "classId_2",
    "crowdedness": 29,
    "locationId": "locationId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "e344sf43-9tur-65vl-e9x7-o30xqh92ujq",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "deadline": "deadline_1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "rltlb0og-jp3u-d28m-j1gm-au1muw2pay",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "timeOfDay": "timeOfDay_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "ntn3psst-9kqk-0yyo-1ohp-2zubnl5ekmo",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "oxlpvsyt-py41-9xc0-1fqv-ixdqjwfqx2j",
      "hyvs3ti7-sm7t-yc7u-prkm-g2x1gj0958t",
      "ktaq60jy-1qck-7vzo-er8t-zcwxe0shgtf",
      "me73bej8-3477-3d8w-obbd-85s0iw2nrhu"
    ]
  },
  {
    "id": "8ulxdnxs-8kf3-egjo-417i-7j6p29am2x5",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "oxlpvsyt-py41-9xc0-1fqv-ixdqjwfqx2j",
      "hyvs3ti7-sm7t-yc7u-prkm-g2x1gj0958t",
      "ktaq60jy-1qck-7vzo-er8t-zcwxe0shgtf",
      "me73bej8-3477-3d8w-obbd-85s0iw2nrhu"
    ]
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "l13yifff-b4gp-o1v5-sv42-tafkmwku3e9",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "wj3hx53n-iou4-0w5r-xz8k-js8hzppldi",
      "hddsgrc4-639a-zp6x-ehe7-xq3pzb1v5rg"
    ],
    "cohortIds": [
      "ntn3psst-9kqk-0yyo-1ohp-2zubnl5ekmo",
      "8ulxdnxs-8kf3-egjo-417i-7j6p29am2x5"
    ],
    "rubricId": "rubricId_1"
  },
  {
    "id": "bzh8o05d-8zao-izek-hrnm-5y78gv39eb6",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "wj3hx53n-iou4-0w5r-xz8k-js8hzppldi",
      "hddsgrc4-639a-zp6x-ehe7-xq3pzb1v5rg"
    ],
    "cohortIds": [
      "ntn3psst-9kqk-0yyo-1ohp-2zubnl5ekmo",
      "8ulxdnxs-8kf3-egjo-417i-7j6p29am2x5"
    ],
    "rubricId": "rubricId_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "obdj7mer-2rb2-nuzs-qn9a-gf2enjyfwq",
    "createdAt": "2025-07-18T19:29:39.397Z"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "cir4n3bv-4d1c-h3y7-dz9j-7hbtblg2j74",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "completedAt": "2025-07-18T19:29:39.397Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "57jnvkir-ofcx-f23c-dqh1-efvwm7jx4iu",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "updatedAt": "2025-07-18T19:29:39.397Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query"
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "kre1lifu-s3l5-z2xn-s7fb-1v3k4lho22m",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "passed": true,
    "score": 3,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "rkm7l5cv-ez42-1ld4-ep48-5uh1wvrlzb8",
    "createdAt": "2025-07-18T19:29:39.397Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 20
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-18T19:29:39.397Z"
  }
];


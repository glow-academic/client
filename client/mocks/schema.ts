// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 45,
    "userId": 81,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 93,
    "scope": "scope_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 83,
    "userId": 7,
    "expires": "2025-07-18T14:25:19.692Z",
    "sessionToken": "sessionToken_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 61,
    "name": "Admin User",
    "emailVerified": "2025-07-18T14:25:19.692Z"
  },
  {
    "id": 57,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-18T14:25:19.692Z",
    "image": "image_2"
  },
  {
    "id": 83
  },
  {
    "id": 22,
    "name": "TA User",
    "emailVerified": "2025-07-18T14:25:19.692Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "5ots0iye-llx1-hln7-w84h-h2bv5q5qmya",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "userId": 61,
    "lastLogin": "2025-07-18T14:25:19.692Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "role": "admin",
    "active": true,
    "lastActive": "2025-07-18T14:25:19.692Z"
  },
  {
    "id": "pr88op8c-kbjh-6kaz-jey7-su6pffwskz",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "userId": 57,
    "lastLogin": "2025-07-18T14:25:19.692Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "role": "instructional",
    "active": false,
    "lastActive": "2025-07-18T14:25:19.692Z"
  },
  {
    "id": "711xo6fj-0apc-unlb-7rch-mkw6ah52td",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "lastLogin": "2025-07-18T14:25:19.692Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "role": "instructor",
    "active": false,
    "lastActive": "2025-07-18T14:25:19.692Z",
    "userId": 83
  },
  {
    "id": "im9qifci-w7kt-8d1f-fejy-svddeex59i",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "lastLogin": "2025-07-18T14:25:19.692Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "role": "ta",
    "active": false,
    "lastActive": "2025-07-18T14:25:19.692Z",
    "userId": 22
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "ianjbi5f-ugle-bdpr-fws0-hmf30qpoti",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// DEPARTMENTS MOCK DATA
export const departments = [
  {
    "id": "4lbrhx9h-8jl3-x87m-intf-opxmeaz9y6n",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "departmentCode": "departmentCode_1",
    "name": "Departments 1",
    "description": "Description for departments 1",
    "profileIds": [
      "5ots0iye-llx1-hln7-w84h-h2bv5q5qmya",
      "pr88op8c-kbjh-6kaz-jey7-su6pffwskz",
      "711xo6fj-0apc-unlb-7rch-mkw6ah52td",
      "im9qifci-w7kt-8d1f-fejy-svddeex59i"
    ]
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "vmxoz2ba-wal0-3vvp-j6va-akoa7n2or45",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "departmentId": "departmentId_1",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1",
    "profileIds": [
      "5ots0iye-llx1-hln7-w84h-h2bv5q5qmya",
      "pr88op8c-kbjh-6kaz-jey7-su6pffwskz",
      "711xo6fj-0apc-unlb-7rch-mkw6ah52td",
      "im9qifci-w7kt-8d1f-fejy-svddeex59i"
    ]
  },
  {
    "id": "n0915iyi-0q63-nln1-6xyr-tpbhwpufywr",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "departmentId": "departmentId_2",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2",
    "profileIds": [
      "5ots0iye-llx1-hln7-w84h-h2bv5q5qmya",
      "pr88op8c-kbjh-6kaz-jey7-su6pffwskz",
      "711xo6fj-0apc-unlb-7rch-mkw6ah52td",
      "im9qifci-w7kt-8d1f-fejy-svddeex59i"
    ]
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "bmrj23r0-j2sz-1d7g-nbzf-1scadibp41z",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// LOCATIONS MOCK DATA
export const locations = [
  {
    "id": "va2gwduo-6746-26ey-ct26-43wjupldcdo",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Locations 1",
    "description": "Description for locations 1",
    "departmentId": "departmentId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "7jxvle4s-yeia-g2bt-ejjw-1tsylwe6n3n",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "sgl3vaju-9jtl-empl-n2wr-cai8jnam4yj",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 98,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "sbmr3q24-u7ko-81r4-6337-0obhrkm21nc",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 97,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "utfyxpnf-s1pm-q7gt-9b6k-5x318hlmm3n",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 27,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "ojwsdyj7-xs7q-971n-uulk-bttw0bwsn9",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 90,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 30,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-18T14:25:19.692Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 100,
    "createdAt": "2025-07-18T14:25:19.692Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "hkczq0n2-7dtd-wzyx-9sdh-887ut2cbth5",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "185t7c84-0wy7-qh3y-kygn-0qhkcpcqartq",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "completedAt": "2025-07-18T14:25:19.692Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "k8t4bqfn-1yba-mqf7-eftx-ri7v17zs0xe",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "completedAt": "2025-07-18T14:25:19.692Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": true
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "a9dv2f02-ifmy-jftj-uz02-rx7jnmn4rht",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true,
    "defaultComponent": "defaultComponent_1"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "9et94gh6-xgg6-z2i0-2nag-9b8fcqa7rvn",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
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
    "mainSplit": "mainSplit_1",
    "footerSplit": "footerSplit_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "xosbnl37-d4ha-dxpu-awrj-ugv7baeiwq",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.36,
    "defaultAgent": "defaultAgent_1",
    "editable": false,
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "3yew1nl6-eviv-ao55-jglj-mvgj5fyd9ar",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.87,
    "defaultAgent": "defaultAgent_2",
    "editable": false,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "p2lbb98v-9gq0-jjf9-fmnl-z0ya6x6lxe",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "crowdedness": 84,
    "intensity": 85,
    "locationId": "locationId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true
  },
  {
    "id": "zyab0u73-bfhx-u2up-rapd-rbdh6yh2c2k",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "crowdedness": 43,
    "intensity": 34,
    "locationId": "locationId_2",
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "s5z9jw66-kvz6-aj6q-9n55-99hnc1cm8qu",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "nukscb9o-rhb0-kl7z-7h6z-7pjwmciblb7",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "a06cc09x-w0ju-nofa-v7io-52r3zyunz69",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "5ots0iye-llx1-hln7-w84h-h2bv5q5qmya",
      "pr88op8c-kbjh-6kaz-jey7-su6pffwskz",
      "711xo6fj-0apc-unlb-7rch-mkw6ah52td",
      "im9qifci-w7kt-8d1f-fejy-svddeex59i"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "3tva8p6f-5011-a0fh-nj8b-uj5yq5nhzi",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "5ots0iye-llx1-hln7-w84h-h2bv5q5qmya",
      "pr88op8c-kbjh-6kaz-jey7-su6pffwskz",
      "711xo6fj-0apc-unlb-7rch-mkw6ah52td",
      "im9qifci-w7kt-8d1f-fejy-svddeex59i"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "x3nvswej-ew08-ua1w-apsg-sggc4x4ttf",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "p2lbb98v-9gq0-jjf9-fmnl-z0ya6x6lxe",
      "zyab0u73-bfhx-u2up-rapd-rbdh6yh2c2k"
    ],
    "cohortIds": [
      "a06cc09x-w0ju-nofa-v7io-52r3zyunz69",
      "3tva8p6f-5011-a0fh-nj8b-uj5yq5nhzi"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "yvye35ex-6sw1-j825-b8ml-xrq0as00gaq",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "p2lbb98v-9gq0-jjf9-fmnl-z0ya6x6lxe",
      "zyab0u73-bfhx-u2up-rapd-rbdh6yh2c2k"
    ],
    "cohortIds": [
      "a06cc09x-w0ju-nofa-v7io-52r3zyunz69",
      "3tva8p6f-5011-a0fh-nj8b-uj5yq5nhzi"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "xbmkri8e-uqaq-r7ci-2nw7-bq6zmtjbph4",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "71vqzw6l-eztm-mxsw-roha-w8rg0rkb5n",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "completedAt": "2025-07-18T14:25:19.692Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "pty0bbln-9j6l-ski4-48b1-5bgy9ll6hzk",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "updatedAt": "2025-07-18T14:25:19.692Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "0zynqys8-fjn1-bs7n-l19f-7e6uor7rx6g",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "passed": true,
    "score": 36,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "4md5oslk-3gs6-gd42-t2gt-7pkamrk2yqs",
    "createdAt": "2025-07-18T14:25:19.692Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 94
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-18T14:25:19.692Z",
    "token": "token_1"
  }
];


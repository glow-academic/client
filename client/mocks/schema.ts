// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 40,
    "userId": 96,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "idToken": "idToken_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 57,
    "userId": 66,
    "expires": "2025-07-20T15:42:43.987Z",
    "sessionToken": "sessionToken_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 34,
    "name": "Admin User",
    "email": "admin@example.com",
    "image": "image_1"
  },
  {
    "id": 40,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-20T15:42:43.987Z",
    "image": "image_2"
  },
  {
    "id": 1,
    "name": "Instructor User",
    "emailVerified": "2025-07-20T15:42:43.987Z"
  },
  {
    "id": 70,
    "emailVerified": "2025-07-20T15:42:43.987Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "nk4a7sdk-yg1m-f292-6myx-gqvzp6k033m",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "lastLogin": "2025-07-20T15:42:43.987Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-20T15:42:43.987Z",
    "userId": 34
  },
  {
    "id": "25ean6t1-11o1-qley-w1wd-3c1k4lu3m7m",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "userId": 40,
    "lastLogin": "2025-07-20T15:42:43.987Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-20T15:42:43.987Z"
  },
  {
    "id": "4lpanqgy-rzcm-evfo-p30o-m574jirwpr",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "userId": 1,
    "lastLogin": "2025-07-20T15:42:43.987Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-20T15:42:43.987Z"
  },
  {
    "id": "bcnenaux-3ydf-7s0x-202f-qnm97doqyvk",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "userId": 70,
    "lastLogin": "2025-07-20T15:42:43.987Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-20T15:42:43.987Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "12c1zxh3-vu6h-78y7-821x-ai2g2zlb28m",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// DEPARTMENTS MOCK DATA
export const departments = [
  {
    "id": "o7z1gbq9-4k4p-dlxr-kycv-62u8uxefxj",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "departmentCode": "departmentCode_1",
    "name": "Departments 1",
    "description": "Description for departments 1",
    "profileIds": [
      "nk4a7sdk-yg1m-f292-6myx-gqvzp6k033m",
      "25ean6t1-11o1-qley-w1wd-3c1k4lu3m7m",
      "4lpanqgy-rzcm-evfo-p30o-m574jirwpr",
      "bcnenaux-3ydf-7s0x-202f-qnm97doqyvk"
    ]
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "1zvutakp-npb1-6w34-62da-6tw7nxjgi3",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "departmentId": "departmentId_1",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1",
    "profileIds": [
      "nk4a7sdk-yg1m-f292-6myx-gqvzp6k033m",
      "25ean6t1-11o1-qley-w1wd-3c1k4lu3m7m",
      "4lpanqgy-rzcm-evfo-p30o-m574jirwpr",
      "bcnenaux-3ydf-7s0x-202f-qnm97doqyvk"
    ]
  },
  {
    "id": "i7oi5b6x-5bge-37k1-crud-y1e3xshlhz",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "departmentId": "departmentId_2",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2",
    "profileIds": [
      "nk4a7sdk-yg1m-f292-6myx-gqvzp6k033m",
      "25ean6t1-11o1-qley-w1wd-3c1k4lu3m7m",
      "4lpanqgy-rzcm-evfo-p30o-m574jirwpr",
      "bcnenaux-3ydf-7s0x-202f-qnm97doqyvk"
    ]
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "msxqzv2o-ewlj-z6zk-neb2-rie9m5364mr",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// LOCATIONS MOCK DATA
export const locations = [
  {
    "id": "eml4qkce-9cvb-xbck-vbb0-hhty3r1n6z",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Locations 1",
    "description": "Description for locations 1",
    "departmentId": "departmentId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "xww2ocss-raq2-zebx-rkkd-8u38k8l1co7",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": false
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "2814irrg-y8g3-u0ao-uv6d-nol86n5cexs",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 14,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "h4i0597m-q1uw-2brk-ztkz-ygpy7unkjbo",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 55,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "4ma4j5q5-m54g-8h07-nv9l-vlvl5qj9xk9",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 66,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "yjuvisyj-8gch-8sfs-xmq5-olmgn2xw6v",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 55,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 58,
    "level": "level_1",
    "createdAt": "2025-07-20T15:42:43.987Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 7,
    "createdAt": "2025-07-20T15:42:43.987Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "0z8bv7q5-cpjq-1ico-9vwy-63v26kt8io",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "u74tqsut-ywkc-xlwn-oopi-0uulcldrfn2p",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "completedAt": "2025-07-20T15:42:43.987Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "itijfiyt-yjg0-0971-1hjm-1hbrr187l73",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "completedAt": "2025-07-20T15:42:43.987Z",
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
    "id": "0gdkj4yq-bcs8-ri9x-bpfh-56xqlbkho32",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": false,
    "defaultComponent": "defaultComponent_1"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "8byzbttb-8xhr-thel-2ur4-ru4yuqayclp",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "profileId": "profileId_1",
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
    "id": "1dpd4c4d-8wpw-xmxs-ri8r-m9cfw0m2d7j",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.86,
    "defaultAgent": "defaultAgent_1",
    "modelId": "modelId_1"
  },
  {
    "id": "90m8n24s-3b0q-rvzw-4mnu-3sys06zayc",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.67,
    "defaultAgent": "defaultAgent_2",
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "dgyxtct4-pjgz-1fjf-tpu5-6j9golp4dga",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.94,
    "modelId": "modelId_1",
    "reasoning": "low"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "s06fn83u-b6ya-f551-7hru-b67h4r7ahov",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "crowdedness": 16,
    "intensity": 4,
    "deadlineId": "deadlineId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false,
    "parentId": "parentId_1"
  },
  {
    "id": "yovja1p3-eey9-12ry-vdmb-7e0vu8ptq5a",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "crowdedness": 62,
    "intensity": 64,
    "locationId": "locationId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "665yuqwi-hs2y-z5of-ubwp-wmeat2zchcc",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "gvfd5d3y-wg52-ptr4-274z-w9suplrkkm",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "xev8gz1c-it79-70zj-kv5k-j7yrwgimhs",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "nk4a7sdk-yg1m-f292-6myx-gqvzp6k033m",
      "25ean6t1-11o1-qley-w1wd-3c1k4lu3m7m",
      "4lpanqgy-rzcm-evfo-p30o-m574jirwpr",
      "bcnenaux-3ydf-7s0x-202f-qnm97doqyvk"
    ],
    "defaultCohort": "defaultCohort_1",
    "departmentId": "departmentId_1"
  },
  {
    "id": "qra8cm1p-zv6d-xsq1-9hvt-8wk6okir4lg",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "nk4a7sdk-yg1m-f292-6myx-gqvzp6k033m",
      "25ean6t1-11o1-qley-w1wd-3c1k4lu3m7m",
      "4lpanqgy-rzcm-evfo-p30o-m574jirwpr",
      "bcnenaux-3ydf-7s0x-202f-qnm97doqyvk"
    ],
    "defaultCohort": "defaultCohort_2",
    "departmentId": "departmentId_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "14z2bem7-f4ad-wsmg-755c-blwpkqv0wh",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "s06fn83u-b6ya-f551-7hru-b67h4r7ahov",
      "yovja1p3-eey9-12ry-vdmb-7e0vu8ptq5a"
    ],
    "cohortIds": [
      "xev8gz1c-it79-70zj-kv5k-j7yrwgimhs",
      "qra8cm1p-zv6d-xsq1-9hvt-8wk6okir4lg"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "qs5jodko-ont6-4mp9-jfog-qhqjx8bi5vo",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "s06fn83u-b6ya-f551-7hru-b67h4r7ahov",
      "yovja1p3-eey9-12ry-vdmb-7e0vu8ptq5a"
    ],
    "cohortIds": [
      "xev8gz1c-it79-70zj-kv5k-j7yrwgimhs",
      "qra8cm1p-zv6d-xsq1-9hvt-8wk6okir4lg"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "jpr3dxae-lvgi-apke-0nas-3mvkrqh99uq",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "h4nnu0p1-bfe6-3ru5-bjck-ik22vljpge",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "completedAt": "2025-07-20T15:42:43.987Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "0xq4450u-8ovl-l1be-iy27-5gzarv63x3v",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "updatedAt": "2025-07-20T15:42:43.987Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "aspdv0x2-3xv3-zcud-vlwi-kvysa5tbpe9",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "passed": true,
    "score": 57,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "9mvjgrpo-72lw-rpac-9xhe-zbfckowlxmi",
    "createdAt": "2025-07-20T15:42:43.987Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 44,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-20T15:42:43.987Z",
    "token": "token_1"
  }
];


// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "q9bzj5xd-hzyd-4jv0-1czd-0aeu1xz6f6l",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "phsk43bf-k989-qbfg-48cl-wn0clsj3ufr",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// TOPICS MOCK DATA
export const topics = [
  {
    "id": "vdz2jpmk-0yrt-gh7w-49yc-6xnpsxmuzw2",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": true,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "p5ir3p7h-ts9u-seup-u3a6-bwhakwpmrw8",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "as2xmpbd-b4b6-b99t-p3oy-xl06na8ddi",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-07-15T03:30:01.540Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "jec2dpr9-9486-nvxn-3fau-g83ocmspxij",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "8id4yw15-aapa-0h04-5fim-sz91xn7n8q",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 30,
    "userId": 93,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 44,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 80,
    "userId": 63,
    "expires": "2025-07-15T03:30:01.540Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "b14nx97p-jq07-k6qq-sxfm-o58ikiz9808",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 70,
    "emailVerified": "2025-07-15T03:30:01.540Z",
    "image": "image_1"
  },
  {
    "id": 94,
    "name": "Instructional User",
    "emailVerified": "2025-07-15T03:30:01.540Z",
    "image": "image_2"
  },
  {
    "id": 30,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-07-15T03:30:01.540Z",
    "image": "image_3"
  },
  {
    "id": 12
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "58v03j02-qjh3-9fx5-5mcf-z6mv787nka",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "userId": 70,
    "lastLogin": "2025-07-15T03:30:01.540Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "role": "admin",
    "classIds": [
      "q9bzj5xd-hzyd-4jv0-1czd-0aeu1xz6f6l",
      "phsk43bf-k989-qbfg-48cl-wn0clsj3ufr"
    ],
    "active": true,
    "lastActive": "2025-07-15T03:30:01.540Z"
  },
  {
    "id": "av3e7wtq-j3wf-r07f-24ka-lxtlrqsieih",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "lastLogin": "2025-07-15T03:30:01.540Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "role": "instructional",
    "classIds": [
      "q9bzj5xd-hzyd-4jv0-1czd-0aeu1xz6f6l",
      "phsk43bf-k989-qbfg-48cl-wn0clsj3ufr"
    ],
    "active": false,
    "lastActive": "2025-07-15T03:30:01.540Z",
    "userId": 94
  },
  {
    "id": "z0cto5vj-xopw-gtv4-cnpr-czhgmiaqp0m",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "userId": 30,
    "lastLogin": "2025-07-15T03:30:01.540Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "role": "instructor",
    "classIds": [
      "q9bzj5xd-hzyd-4jv0-1czd-0aeu1xz6f6l",
      "phsk43bf-k989-qbfg-48cl-wn0clsj3ufr"
    ],
    "active": false,
    "lastActive": "2025-07-15T03:30:01.540Z"
  },
  {
    "id": "ph6ozpe2-l2ud-qj75-hxxi-0qcta2sm236",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "userId": 12,
    "lastLogin": "2025-07-15T03:30:01.540Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "role": "ta",
    "classIds": [
      "q9bzj5xd-hzyd-4jv0-1czd-0aeu1xz6f6l",
      "phsk43bf-k989-qbfg-48cl-wn0clsj3ufr"
    ],
    "active": false,
    "lastActive": "2025-07-15T03:30:01.540Z"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "zhzqmifo-0jt3-kegm-iivq-p67n5upxhj",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 73,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "g9ia5dh9-wcoe-xwo4-9l1h-zbwkfudrf4g",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 48,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "veui2b58-o3y0-l0di-udzp-lrijus80fa9",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 23,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "2wur7j69-6qos-mp89-9da5-v57zyynv3f",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 48,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 53,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-15T03:30:01.540Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 19,
    "createdAt": "2025-07-15T03:30:01.540Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "ibva4xfi-6p7p-e9ds-5hw3-rk9qqguwqv",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "bto3h2cz-x7df-v9jh-5cg8-d8oj3x1jxkh",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "crowdedness": 54,
    "intensity": 10,
    "seniority": "freshman",
    "tod": "9AM",
    "defaultScenario": "defaultScenario_1",
    "generated": true
  },
  {
    "id": "gissyrer-r51v-8ayo-ooed-cjv6v6ofhsm",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "crowdedness": 37,
    "intensity": 81,
    "location": "haas",
    "tod": "10AM",
    "defaultScenario": "defaultScenario_2",
    "generated": false
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "zq4281qz-mwx7-bytf-9aaz-nd1e3wngl6h",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "completedAt": "2025-07-15T03:30:01.540Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "c6jr9wbn-6gj5-p0xw-jd6h-ubhh1j51o3k",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
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
    "id": "gvj328vx-9vi2-nsc2-oh6p-ly5gpib9f2a",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true,
    "defaultComponent": "defaultComponent_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "ofr83udc-5sf9-ltmq-cfzx-wmojp6tffy",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.24,
    "defaultAgent": "defaultAgent_1",
    "editable": false,
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "q5x3nmcf-f5xa-46mv-crvz-g6arej06g2o",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.92,
    "defaultAgent": "defaultAgent_2",
    "editable": false,
    "reasoning": "medium"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "2z707pjt-ixho-hig9-4x48-u5w96vw3xy",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
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

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "1c1zxqne-t4k7-qry5-ectn-weckqfv8jyh",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "58v03j02-qjh3-9fx5-5mcf-z6mv787nka",
      "av3e7wtq-j3wf-r07f-24ka-lxtlrqsieih",
      "z0cto5vj-xopw-gtv4-cnpr-czhgmiaqp0m",
      "ph6ozpe2-l2ud-qj75-hxxi-0qcta2sm236"
    ]
  },
  {
    "id": "nlu9zb89-jngn-g5bp-ase8-8zhcfz4i3c",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "58v03j02-qjh3-9fx5-5mcf-z6mv787nka",
      "av3e7wtq-j3wf-r07f-24ka-lxtlrqsieih",
      "z0cto5vj-xopw-gtv4-cnpr-czhgmiaqp0m",
      "ph6ozpe2-l2ud-qj75-hxxi-0qcta2sm236"
    ]
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "6l8zrwye-cjep-9lmd-msgd-z8g3y4xz7ma",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "bto3h2cz-x7df-v9jh-5cg8-d8oj3x1jxkh",
      "gissyrer-r51v-8ayo-ooed-cjv6v6ofhsm"
    ],
    "cohortIds": [
      "1c1zxqne-t4k7-qry5-ectn-weckqfv8jyh",
      "nlu9zb89-jngn-g5bp-ase8-8zhcfz4i3c"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "4oi1xpot-547v-e2gr-5vqt-775z4nr8fve",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "bto3h2cz-x7df-v9jh-5cg8-d8oj3x1jxkh",
      "gissyrer-r51v-8ayo-ooed-cjv6v6ofhsm"
    ],
    "cohortIds": [
      "1c1zxqne-t4k7-qry5-ectn-weckqfv8jyh",
      "nlu9zb89-jngn-g5bp-ase8-8zhcfz4i3c"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "qv25skqr-qs6a-cjfb-jp0h-ymtvcqya73",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "0zez9s5b-bs8e-22l6-td47-udmq73ae08",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "completedAt": "2025-07-15T03:30:01.540Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "4bnrg02f-8b8z-4iuh-l78m-ikszjly4xk",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "updatedAt": "2025-07-15T03:30:01.540Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "abzq7120-rg3q-r9if-mdwc-ddhl7g6zs5",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "passed": true,
    "score": 50,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "vmwfzedc-6uyp-tzb4-dwni-2fzcxphm8z1",
    "createdAt": "2025-07-15T03:30:01.540Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 68
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-15T03:30:01.540Z",
    "token": "token_1"
  }
];


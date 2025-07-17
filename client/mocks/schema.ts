// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "ovbrxf86-x1an-sd1w-9r7f-oh6xahflmc",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "b98fadqe-7hlk-hj6e-0bco-z94l80wapf",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
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
    "id": "lqfol23l-ukba-5nfi-kpkh-99944dhe75m",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": true,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "lnpxs8lg-y904-zru0-g6by-8dzcrb2lb6j",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "zwu84glg-krpb-eai2-pkbw-dpwsavvsjtm",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-07-17T01:41:01.066Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "ju0rhvmf-43or-7jne-wrgu-pay61oexwkf",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "qhw66p0x-xfiq-s7hr-v2gj-qptq9do1npf",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 45,
    "userId": 8,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 27,
    "userId": 10,
    "expires": "2025-07-17T01:41:01.066Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "azvoa6wl-d8xm-ho3b-alg2-4n42hqfik0v",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 28,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-17T01:41:01.066Z",
    "image": "image_1"
  },
  {
    "id": 17,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "image": "image_2"
  },
  {
    "id": 83,
    "name": "Instructor User"
  },
  {
    "id": 87,
    "name": "TA User",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "1h638lom-dh6y-cbt7-k4wk-cx22afwqz3s",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "lastLogin": "2025-07-17T01:41:01.066Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "role": "admin",
    "classIds": [
      "ovbrxf86-x1an-sd1w-9r7f-oh6xahflmc",
      "b98fadqe-7hlk-hj6e-0bco-z94l80wapf"
    ],
    "active": true,
    "lastActive": "2025-07-17T01:41:01.066Z",
    "userId": 28
  },
  {
    "id": "qchhu3sr-71lk-5lh2-5nfp-m6htp3rktf",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "lastLogin": "2025-07-17T01:41:01.066Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "role": "instructional",
    "classIds": [
      "ovbrxf86-x1an-sd1w-9r7f-oh6xahflmc",
      "b98fadqe-7hlk-hj6e-0bco-z94l80wapf"
    ],
    "active": false,
    "lastActive": "2025-07-17T01:41:01.066Z",
    "userId": 17
  },
  {
    "id": "0p0ftmim-4pij-8w21-mc3o-p1fq9rvb1l",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "userId": 83,
    "lastLogin": "2025-07-17T01:41:01.066Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "role": "instructor",
    "classIds": [
      "ovbrxf86-x1an-sd1w-9r7f-oh6xahflmc",
      "b98fadqe-7hlk-hj6e-0bco-z94l80wapf"
    ],
    "active": false,
    "lastActive": "2025-07-17T01:41:01.066Z"
  },
  {
    "id": "zayr9g05-nzc9-5hc9-ecdq-yorsb2rst2",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "userId": 87,
    "lastLogin": "2025-07-17T01:41:01.066Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "role": "ta",
    "classIds": [
      "ovbrxf86-x1an-sd1w-9r7f-oh6xahflmc",
      "b98fadqe-7hlk-hj6e-0bco-z94l80wapf"
    ],
    "active": false,
    "lastActive": "2025-07-17T01:41:01.066Z"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "g6v76ado-25r1-nbti-aea0-1rtuvk67k2g",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 93,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "8aa2difs-jc22-xycj-qol1-xnph45eefyl",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 90,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "h5kz111j-7wxx-res4-r3bi-v3xcswp4ng",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 83,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "jyk51gdg-snva-bapq-lsfd-nvjhoz5layj",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 10,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 85,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-17T01:41:01.066Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 80,
    "createdAt": "2025-07-17T01:41:01.066Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "wlyjpk5n-d0de-nlem-p5wd-hlt9xziw54",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "r0jyv7mj-oppn-ft1a-8chk-gf0sd2ke1id",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "intensity": 18,
    "location": "lawson",
    "tod": "9AM",
    "urgency": "hour",
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true
  },
  {
    "id": "bq7nrimo-0na8-ebpn-ahuo-h0si7arw6cr",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "crowdedness": 34,
    "intensity": 95,
    "seniority": "sophomore",
    "location": "haas",
    "urgency": "day",
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "0exohoaj-u15z-htoz-lymj-2izc6hpehnp",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "completedAt": "2025-07-17T01:41:01.066Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "pp4um55c-q735-2p0u-yhjl-6mw0cj9yc44",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "completedAt": "2025-07-17T01:41:01.066Z",
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
    "id": "msj7tf6g-qxap-9b33-hlvv-zipbo48grpf",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
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
    "id": "4zp6c2k8-9ll2-8i3k-n1bj-fyr2qrx70tt",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.65,
    "defaultAgent": "defaultAgent_1",
    "editable": false,
    "modelId": "modelId_1"
  },
  {
    "id": "hv9loh5a-xlco-jzt7-ndgm-vz99l1lf0fi",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.5,
    "defaultAgent": "defaultAgent_2",
    "editable": false,
    "reasoning": "medium"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "jb3niv4z-qyns-dn86-17qh-8fjpro347z6",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
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
    "id": "evt22ok8-u8ro-az83-pmau-bag8gah8qfg",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "1h638lom-dh6y-cbt7-k4wk-cx22afwqz3s",
      "qchhu3sr-71lk-5lh2-5nfp-m6htp3rktf",
      "0p0ftmim-4pij-8w21-mc3o-p1fq9rvb1l",
      "zayr9g05-nzc9-5hc9-ecdq-yorsb2rst2"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "4p3v02kj-e335-xc1c-l4js-tn37xeclm5p",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "1h638lom-dh6y-cbt7-k4wk-cx22afwqz3s",
      "qchhu3sr-71lk-5lh2-5nfp-m6htp3rktf",
      "0p0ftmim-4pij-8w21-mc3o-p1fq9rvb1l",
      "zayr9g05-nzc9-5hc9-ecdq-yorsb2rst2"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "40b623in-kcge-66v5-whk0-e1q3kbleqn",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "r0jyv7mj-oppn-ft1a-8chk-gf0sd2ke1id",
      "bq7nrimo-0na8-ebpn-ahuo-h0si7arw6cr"
    ],
    "cohortIds": [
      "evt22ok8-u8ro-az83-pmau-bag8gah8qfg",
      "4p3v02kj-e335-xc1c-l4js-tn37xeclm5p"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "pe2ap5gu-s697-ftd7-fxui-l1v3pgs8ose",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "r0jyv7mj-oppn-ft1a-8chk-gf0sd2ke1id",
      "bq7nrimo-0na8-ebpn-ahuo-h0si7arw6cr"
    ],
    "cohortIds": [
      "evt22ok8-u8ro-az83-pmau-bag8gah8qfg",
      "4p3v02kj-e335-xc1c-l4js-tn37xeclm5p"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "voubnpcj-b330-1rvt-e4tu-ru84imuhln",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "iqpz9cbc-bgpb-r4ba-zy68-ksd68qfu21l",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "completedAt": "2025-07-17T01:41:01.066Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "j5ufv7cb-qsth-ej5t-5o9m-eisalowxq7n",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "updatedAt": "2025-07-17T01:41:01.066Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "pxtsfvg2-1vut-ej3a-biqt-xf8bd90czv",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "passed": true,
    "score": 56,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "f5uhi3tz-30zt-ty1x-411m-uf2q464li3k",
    "createdAt": "2025-07-17T01:41:01.066Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 37,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-17T01:41:01.066Z",
    "token": "token_1"
  }
];


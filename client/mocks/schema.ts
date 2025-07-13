// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "eg0cb6dc-3re8-22hh-avrc-soo8slnest",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "ehnyiccx-fwqo-q5yy-q9m9-7a3er1kxpmq",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
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
    "id": "81spjjk3-rad1-u2wg-8l1v-3m2lpvqnle6",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": false,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "m0zwcada-4so5-85fc-aa16-s2nlui6t4c",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "ottbd1nv-1zu6-5ory-6t4z-vmchjqlh6d9",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-07-11T19:59:04.056Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "vvb5vsv7-lkq8-dnk4-yhb2-kvrt3592tz",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
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
    "id": "69hwd2kb-033i-3t2y-0qqh-qw9e9djq51p",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 87,
    "userId": 64,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "scope": "scope_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 61,
    "userId": 12,
    "expires": "2025-07-11T19:59:04.056Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "h99s4mfa-mmh6-0ncl-ic51-01uf7a0g4ryt",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true,
    "modelType": "modelType_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 18,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-11T19:59:04.056Z",
    "image": "image_1"
  },
  {
    "id": 63,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-11T19:59:04.056Z",
    "image": "image_2"
  },
  {
    "id": 4,
    "name": "Instructor User",
    "emailVerified": "2025-07-11T19:59:04.056Z",
    "image": "image_3"
  },
  {
    "id": 75,
    "emailVerified": "2025-07-11T19:59:04.056Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "xrvf9r8c-sjce-9uiu-89g8-6art54g8k7q",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "lastLogin": "2025-07-11T19:59:04.056Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "role": "admin",
    "classIds": [
      "eg0cb6dc-3re8-22hh-avrc-soo8slnest",
      "ehnyiccx-fwqo-q5yy-q9m9-7a3er1kxpmq"
    ],
    "active": true,
    "lastActive": "2025-07-11T19:59:04.056Z",
    "userId": 18
  },
  {
    "id": "lbu7trt6-9xiz-mmyy-dqvg-r4aphe6jeo",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "userId": 63,
    "lastLogin": "2025-07-11T19:59:04.056Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "role": "instructional",
    "classIds": [
      "eg0cb6dc-3re8-22hh-avrc-soo8slnest",
      "ehnyiccx-fwqo-q5yy-q9m9-7a3er1kxpmq"
    ],
    "active": false,
    "lastActive": "2025-07-11T19:59:04.056Z"
  },
  {
    "id": "efgxri7z-xj23-id6u-9n11-0nemkd26mdc",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "lastLogin": "2025-07-11T19:59:04.056Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "role": "instructor",
    "classIds": [
      "eg0cb6dc-3re8-22hh-avrc-soo8slnest",
      "ehnyiccx-fwqo-q5yy-q9m9-7a3er1kxpmq"
    ],
    "active": false,
    "lastActive": "2025-07-11T19:59:04.056Z",
    "userId": 4
  },
  {
    "id": "x02hvbmw-7kwp-m5hr-4o77-zu3qmsuj0v",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "lastLogin": "2025-07-11T19:59:04.056Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "role": "ta",
    "classIds": [
      "eg0cb6dc-3re8-22hh-avrc-soo8slnest",
      "ehnyiccx-fwqo-q5yy-q9m9-7a3er1kxpmq"
    ],
    "active": false,
    "lastActive": "2025-07-11T19:59:04.056Z",
    "userId": 75
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "jiqkbjys-uyvp-6vid-ccc7-icl26avjyve",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 1,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "s6xu83c3-v6s2-eo44-4sx3-c766z0ly8m",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 89,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "el9o5vdw-lz0e-gm7q-wnf6-16csfgg949v",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 54,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "1sqbbvd9-8tuc-ml9o-2p6m-0bexmh4ckc9s",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 51,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 49,
    "level": "level_1",
    "message": "message_1",
    "createdAt": "2025-07-11T19:59:04.056Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 48,
    "createdAt": "2025-07-11T19:59:04.056Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "9bpl115s-0g93-sim2-t7aq-cx2valbczd",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "3j03u7c2-6u0a-6lsw-5kcg-a8evyzjx6q",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "crowdedness": 35,
    "intensity": 71,
    "location": "lawson",
    "tod": "9AM",
    "defaultScenario": "defaultScenario_1",
    "generated": false
  },
  {
    "id": "sipd9zm1-uj2b-flop-5zvq-4sva612tfm",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "crowdedness": 93,
    "intensity": 91,
    "seniority": "sophomore",
    "tod": "10AM",
    "defaultScenario": "defaultScenario_2",
    "generated": true
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "i9n4i1zk-gmf1-obic-2kiu-lxcwnnf7snb",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "completedAt": "2025-07-11T19:59:04.056Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "msdqut1e-r60s-gbfr-mwvr-ep76w820zev",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
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
    "id": "nsfnfdtx-m4mx-8xor-8soo-jykk9ksf3pl",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": false,
    "defaultComponent": "defaultComponent_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "wutc1qmw-d5lv-q3qi-z5yn-q1z1uwzveck",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.24,
    "defaultAgent": "defaultAgent_1",
    "voiceAgent": "voiceAgent_1",
    "editable": false,
    "modelId": "modelId_1",
    "sttModelId": "sttModelId_1",
    "ttsModelId": "ttsModelId_1",
    "reasoning": "low"
  },
  {
    "id": "hx7f80lg-lue6-s6e1-c0h9-33qu1syy9xw",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.93,
    "defaultAgent": "defaultAgent_2",
    "voiceAgent": "voiceAgent_2",
    "editable": false,
    "modelId": "modelId_2",
    "sttModelId": "sttModelId_2",
    "ttsModelId": "ttsModelId_2",
    "reasoning": "medium"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "i84e9n1n-zs7m-gs77-qw07-c9kdz300g6j",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
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
    "id": "j3s4ffwz-orqt-avec-7mb0-rr2oiv7u4i",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "xrvf9r8c-sjce-9uiu-89g8-6art54g8k7q",
      "lbu7trt6-9xiz-mmyy-dqvg-r4aphe6jeo",
      "efgxri7z-xj23-id6u-9n11-0nemkd26mdc",
      "x02hvbmw-7kwp-m5hr-4o77-zu3qmsuj0v"
    ]
  },
  {
    "id": "h6g2cvw5-9qpf-kq4z-ncbi-0ngrqmyxrfln",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "xrvf9r8c-sjce-9uiu-89g8-6art54g8k7q",
      "lbu7trt6-9xiz-mmyy-dqvg-r4aphe6jeo",
      "efgxri7z-xj23-id6u-9n11-0nemkd26mdc",
      "x02hvbmw-7kwp-m5hr-4o77-zu3qmsuj0v"
    ]
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "j6p48xku-dctm-5s26-q9fu-xnsrm9h9bdr",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "3j03u7c2-6u0a-6lsw-5kcg-a8evyzjx6q",
      "sipd9zm1-uj2b-flop-5zvq-4sva612tfm"
    ],
    "cohortIds": [
      "j3s4ffwz-orqt-avec-7mb0-rr2oiv7u4i",
      "h6g2cvw5-9qpf-kq4z-ncbi-0ngrqmyxrfln"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "2ubqwcub-p9wl-uq5h-nnmt-ip8zatl8nx8",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "3j03u7c2-6u0a-6lsw-5kcg-a8evyzjx6q",
      "sipd9zm1-uj2b-flop-5zvq-4sva612tfm"
    ],
    "cohortIds": [
      "j3s4ffwz-orqt-avec-7mb0-rr2oiv7u4i",
      "h6g2cvw5-9qpf-kq4z-ncbi-0ngrqmyxrfln"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "511inzzh-9q3l-vkqs-8yz1-itsif2ipo2j",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "pslbg0dh-yie2-c6ot-rjbx-4yxdvvmz8ax",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "completedAt": "2025-07-11T19:59:04.056Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "hv8qlljw-8tv8-usez-w96j-wjpswfs9zi9",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "audio": true,
    "filePath": "filePath_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONSKETCHES MOCK DATA
export const simulationSketches = [
  {
    "id": "5x83ea51-rfoa-8egj-u5cr-cel84urdo7t",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "updatedAt": "2025-07-11T19:59:04.056Z",
    "chatId": "chatId_1",
    "filePath": "filePath_1"
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "ix7cjiuz-1oem-5pv5-awbl-femix2lng6k",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "passed": true,
    "score": 32,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "wrmz6ts6-ozed-cl4l-uou6-m4wvp0nwsu",
    "createdAt": "2025-07-11T19:59:04.056Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 14,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-11T19:59:04.056Z",
    "token": "token_1"
  }
];


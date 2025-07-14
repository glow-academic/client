// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 87,
    "userId": 76,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 87,
    "idToken": "idToken_1",
    "sessionState": "sessionState_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 71,
    "createdAt": "2025-07-14T00:09:06.447Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "cch1ejf7-fba9-yu28-c7xn-ndb2d9w8mbd",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "userId": 80,
    "lastLogin": "2025-07-14T00:09:06.447Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "role": "admin",
    "classIds": [
      "7qt67b59-hhab-0x8r-xqsc-to7a9mhk1fi",
      "exyj7un8-4vcy-kmov-qpi7-ixsa98kz8ij"
    ],
    "active": true,
    "lastActive": "2025-07-14T00:09:06.447Z"
  },
  {
    "id": "wk4z02tg-bs4b-ac9v-xett-b8divdrmhl9",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "lastLogin": "2025-07-14T00:09:06.447Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "role": "instructional",
    "classIds": [
      "7qt67b59-hhab-0x8r-xqsc-to7a9mhk1fi",
      "exyj7un8-4vcy-kmov-qpi7-ixsa98kz8ij"
    ],
    "active": false,
    "lastActive": "2025-07-14T00:09:06.447Z",
    "userId": 49
  },
  {
    "id": "r55p0iwd-xvnb-qrox-myoo-2o4cijb1x5p",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "userId": 51,
    "lastLogin": "2025-07-14T00:09:06.447Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "role": "instructor",
    "classIds": [
      "7qt67b59-hhab-0x8r-xqsc-to7a9mhk1fi",
      "exyj7un8-4vcy-kmov-qpi7-ixsa98kz8ij"
    ],
    "active": false,
    "lastActive": "2025-07-14T00:09:06.447Z"
  },
  {
    "id": "1ezw770b-hk4k-9isi-30ub-ucrsmxcg2e",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "userId": 44,
    "lastLogin": "2025-07-14T00:09:06.447Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "role": "ta",
    "classIds": [
      "7qt67b59-hhab-0x8r-xqsc-to7a9mhk1fi",
      "exyj7un8-4vcy-kmov-qpi7-ixsa98kz8ij"
    ],
    "active": false,
    "lastActive": "2025-07-14T00:09:06.447Z"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "iuihok7l-k6bq-1g4z-ly6g-rzhoxxeugeo",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "crowdedness": 99,
    "intensity": 91,
    "tod": "9AM",
    "defaultScenario": "defaultScenario_1",
    "generated": true
  },
  {
    "id": "7e4rroy0-xsve-v4a3-u40d-vwbpq0b2r98",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "crowdedness": 32,
    "intensity": 98,
    "seniority": "sophomore",
    "location": "haas",
    "urgency": "day",
    "defaultScenario": "defaultScenario_2",
    "generated": true
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "qa7ostkt-gyyw-ttde-e2b4-uja8c4unwc",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 56,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-14T00:09:06.447Z"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "wrq4siiq-vtaa-u3t6-x4he-t61a21avg",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "5f15clba-i5bm-dakj-02u8-ennkj38manm",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": true
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "qc9c7rpi-04kb-6t52-rhnk-3vlx92ovy0c",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
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
    "id": "t3puhox1-gzgh-dcx3-axgs-n61pw7hxj7r",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "cch1ejf7-fba9-yu28-c7xn-ndb2d9w8mbd",
      "wk4z02tg-bs4b-ac9v-xett-b8divdrmhl9",
      "r55p0iwd-xvnb-qrox-myoo-2o4cijb1x5p",
      "1ezw770b-hk4k-9isi-30ub-ucrsmxcg2e"
    ]
  },
  {
    "id": "i2qqyr75-eymw-4cqb-mno7-30ft8pidqv9",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "cch1ejf7-fba9-yu28-c7xn-ndb2d9w8mbd",
      "wk4z02tg-bs4b-ac9v-xett-b8divdrmhl9",
      "r55p0iwd-xvnb-qrox-myoo-2o4cijb1x5p",
      "1ezw770b-hk4k-9isi-30ub-ucrsmxcg2e"
    ]
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "3n9w4y7q-caha-2k92-3ads-7ddxk8kqcnq",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": false,
    "defaultComponent": "defaultComponent_1"
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "7qt67b59-hhab-0x8r-xqsc-to7a9mhk1fi",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "exyj7un8-4vcy-kmov-qpi7-ixsa98kz8ij",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "gt9u2ww5-oo5c-8miq-90ee-kb0bis5talm",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.51,
    "defaultAgent": "defaultAgent_1",
    "voiceAgent": "voiceAgent_1",
    "editable": false,
    "modelId": "modelId_1",
    "sttModelId": "sttModelId_1",
    "reasoning": "low"
  },
  {
    "id": "o77qgesg-4mb2-7yva-3sdr-awhwm13y2x4",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.16,
    "defaultAgent": "defaultAgent_2",
    "voiceAgent": "voiceAgent_2",
    "editable": false,
    "modelId": "modelId_2",
    "sttModelId": "sttModelId_2"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "6unt7oub-bgho-6bsm-3raf-e6hy9w9wne",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "time": "2025-07-14T00:09:06.447Z",
    "scheduleId": "scheduleId_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "hwztsv6p-a5su-rao4-pa2y-yr73tdslm5",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "z8k0u03u-28oo-nqlc-22h9-qtca33d1vwi",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 11,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "kvdp5i8g-xlwl-87ro-akgj-jqjv14lwr2i",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 24,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 9,
    "userId": 100,
    "expires": "2025-07-14T00:09:06.447Z",
    "sessionToken": "sessionToken_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "nzbz7jgo-3lrq-y0vj-1qwr-mdnfx4qs0c",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "completedAt": "2025-07-14T00:09:06.447Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false,
    "traceId": "traceId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "ttxhmlyl-bya6-36uw-fsho-b38a73qlm86",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "j5uqx74o-807a-1vxy-yqev-fa6b1kvq20d",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "jorzbgv2-uqyl-c904-4f3x-06q334cm8edd",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "passed": false,
    "score": 28,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// TOPICS MOCK DATA
export const topics = [
  {
    "id": "ae3i8cw1-ufyp-gxvz-zdoy-w7ud98oveth",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": true,
    "classId": "classId_1"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "udxumwfn-u9so-f0od-z6vb-gsuj3rfkg5r",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 51,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "rkson15e-3wg7-1z3v-j8p5-lg2q6so6mhl",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "iuihok7l-k6bq-1g4z-ly6g-rzhoxxeugeo",
      "7e4rroy0-xsve-v4a3-u40d-vwbpq0b2r98"
    ],
    "cohortIds": [
      "t3puhox1-gzgh-dcx3-axgs-n61pw7hxj7r",
      "i2qqyr75-eymw-4cqb-mno7-30ft8pidqv9"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "47nqh2nc-jphm-8zeh-0caf-uevnsnj48va",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "iuihok7l-k6bq-1g4z-ly6g-rzhoxxeugeo",
      "7e4rroy0-xsve-v4a3-u40d-vwbpq0b2r98"
    ],
    "cohortIds": [
      "t3puhox1-gzgh-dcx3-axgs-n61pw7hxj7r",
      "i2qqyr75-eymw-4cqb-mno7-30ft8pidqv9"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "blshr61f-nzfb-2kop-uo74-8l0n3ayqatt",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 23,
    "standardGroupId": "standardGroupId_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "sr4y8vbl-ht24-n5ix-iuxx-8i9naytojrl",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true,
    "modelType": "modelType_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "yix3vfvb-rfyu-yron-ht2n-8f8izm8jb8m",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": false
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 80,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-14T00:09:06.447Z",
    "image": "image_1"
  },
  {
    "id": 49,
    "email": "instructional@example.com",
    "emailVerified": "2025-07-14T00:09:06.447Z",
    "image": "image_2"
  },
  {
    "id": 51,
    "name": "Instructor User",
    "image": "image_3"
  },
  {
    "id": 44,
    "email": "ta@example.com",
    "emailVerified": "2025-07-14T00:09:06.447Z"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "c3sys8kc-ow3v-lh3p-9je2-mbghhpfuig7",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 68,
    "feedback": "feedback_1"
  }
];

// MIGRATIONS MOCK DATA
export const migrations = [
  {
    "id": 45,
    "hash": "hash_1",
    "mode": "mode_1",
    "createdAt": 52
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "be02gc67-7d13-cc3d-x9sq-bql6398e44t",
    "createdAt": "2025-07-14T00:09:06.447Z",
    "updatedAt": "2025-07-14T00:09:06.447Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-14T00:09:06.447Z",
    "token": "token_1"
  }
];


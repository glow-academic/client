// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 91,
    "userId": 10,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "mode": "mode_1",
    "expiresAt": 65,
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 71,
    "userId": 90,
    "expires": "2025-07-18T21:52:47.357Z",
    "sessionToken": "sessionToken_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 8
  },
  {
    "id": 6,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-18T21:52:47.357Z",
    "image": "image_2"
  },
  {
    "id": 21,
    "name": "Instructor User",
    "emailVerified": "2025-07-18T21:52:47.357Z",
    "image": "image_3"
  },
  {
    "id": 37,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-18T21:52:47.357Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "yctyen2q-mlo2-u51p-ezru-68p3k4tuj4p",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "userId": 8,
    "lastLogin": "2025-07-18T21:52:47.357Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "role": "admin",
    "active": true,
    "lastActive": "2025-07-18T21:52:47.357Z"
  },
  {
    "id": "qo6h9abl-tb87-qrqi-mfxm-qbj8rbulb4r",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "lastLogin": "2025-07-18T21:52:47.357Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "role": "instructional",
    "active": false,
    "lastActive": "2025-07-18T21:52:47.357Z",
    "userId": 6
  },
  {
    "id": "fifavyro-ldos-5vzk-6b00-y63mgsycx49",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "userId": 21,
    "lastLogin": "2025-07-18T21:52:47.357Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "role": "instructor",
    "active": false,
    "lastActive": "2025-07-18T21:52:47.357Z"
  },
  {
    "id": "797h33hc-csw3-6yqv-ff1f-lgoj7cdlrb",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "lastLogin": "2025-07-18T21:52:47.357Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "role": "ta",
    "active": false,
    "lastActive": "2025-07-18T21:52:47.357Z",
    "userId": 37
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "d6do274m-v6cp-mkrm-dnxn-ai6mwt8pkcw",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// DEPARTMENTS MOCK DATA
export const departments = [
  {
    "id": "nib2fkp1-7l76-d2vk-g7fm-qkpo63htr4t",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "departmentCode": "departmentCode_1",
    "name": "Departments 1",
    "description": "Description for departments 1",
    "profileIds": [
      "yctyen2q-mlo2-u51p-ezru-68p3k4tuj4p",
      "qo6h9abl-tb87-qrqi-mfxm-qbj8rbulb4r",
      "fifavyro-ldos-5vzk-6b00-y63mgsycx49",
      "797h33hc-csw3-6yqv-ff1f-lgoj7cdlrb"
    ]
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "6xrthyh9-w6n8-tq6u-ixva-52usdg5omlu",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "departmentId": "departmentId_1",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1",
    "profileIds": [
      "yctyen2q-mlo2-u51p-ezru-68p3k4tuj4p",
      "qo6h9abl-tb87-qrqi-mfxm-qbj8rbulb4r",
      "fifavyro-ldos-5vzk-6b00-y63mgsycx49",
      "797h33hc-csw3-6yqv-ff1f-lgoj7cdlrb"
    ]
  },
  {
    "id": "405zhbe0-0uni-5g30-rbkr-zpa1jqo9vnl",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "departmentId": "departmentId_2",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2",
    "profileIds": [
      "yctyen2q-mlo2-u51p-ezru-68p3k4tuj4p",
      "qo6h9abl-tb87-qrqi-mfxm-qbj8rbulb4r",
      "fifavyro-ldos-5vzk-6b00-y63mgsycx49",
      "797h33hc-csw3-6yqv-ff1f-lgoj7cdlrb"
    ]
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "9xz8rgf4-6vbj-69w2-vigv-8yghc3600gs",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// LOCATIONS MOCK DATA
export const locations = [
  {
    "id": "5onl56i0-p2n3-0iru-0557-2sk2suzhahf",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "name": "Locations 1",
    "description": "Description for locations 1",
    "departmentId": "departmentId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "ycu0am43-52fn-geap-fr5v-52iht72d47",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
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
    "id": "ncjdj6q7-iito-jq1t-jxdc-hxp34re1myu",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 84,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "iqrzz88c-7rwg-8map-kg7w-msow1eknpf",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 53,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "zrllahnr-5ys7-uaoc-a02k-w6c1gm331aj",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 14,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "idougrd7-1nmq-kfar-iars-3ye3y7ios38",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 65,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 27,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-18T21:52:47.357Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 23,
    "createdAt": "2025-07-18T21:52:47.357Z",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "75896j3t-ll33-4sxu-bevu-dobhuykek6g",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "j7tk2fis-h2h0-wcms-kmuw-gwd2gyv0g96",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "completedAt": "2025-07-18T21:52:47.357Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "0dh6pbq2-khlz-w835-t89h-uewjn3zjls9",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
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
    "id": "ylkduidm-pplu-ypao-bdwx-5ufmicinzbb",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
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
    "id": "e5zvw7d2-d4z0-xiqh-yle5-9v7dabf7pu",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
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
    "id": "2etxr45r-dvyy-pelf-9k6h-3ey2attexz7",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.35,
    "defaultAgent": "defaultAgent_1",
    "editable": true,
    "reasoning": "low"
  },
  {
    "id": "2ewotjev-3shs-8re4-oomg-5f2gha34abc",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.55,
    "defaultAgent": "defaultAgent_2",
    "editable": false,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "xl6g058f-ok4t-6vn1-yd6w-5p0ogtakput",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "crowdedness": 33,
    "intensity": 20,
    "locationId": "locationId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "parentId": "parentId_1"
  },
  {
    "id": "trc16m7e-6uyz-ut3e-u7bo-872bjpmlyje",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "crowdedness": 43,
    "intensity": 61,
    "locationId": "locationId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "wwoz6g4l-lcdm-laq4-9d8m-nzh0v1q4g3r",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "tfw4bhux-t6dw-1lmb-pff4-0sb5q632nel",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "62dyy0aq-c54y-dqyo-hwzu-po3dazk3f6",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "yctyen2q-mlo2-u51p-ezru-68p3k4tuj4p",
      "qo6h9abl-tb87-qrqi-mfxm-qbj8rbulb4r",
      "fifavyro-ldos-5vzk-6b00-y63mgsycx49",
      "797h33hc-csw3-6yqv-ff1f-lgoj7cdlrb"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "h0y4dlve-hawu-r78v-xpys-d4d4k4x8m6u",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "yctyen2q-mlo2-u51p-ezru-68p3k4tuj4p",
      "qo6h9abl-tb87-qrqi-mfxm-qbj8rbulb4r",
      "fifavyro-ldos-5vzk-6b00-y63mgsycx49",
      "797h33hc-csw3-6yqv-ff1f-lgoj7cdlrb"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "u6s04gxc-nsq5-60ay-tkgb-jffsvnsom",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "xl6g058f-ok4t-6vn1-yd6w-5p0ogtakput",
      "trc16m7e-6uyz-ut3e-u7bo-872bjpmlyje"
    ],
    "cohortIds": [
      "62dyy0aq-c54y-dqyo-hwzu-po3dazk3f6",
      "h0y4dlve-hawu-r78v-xpys-d4d4k4x8m6u"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "f30fo8et-zc29-e2hb-bi8g-f3udfbs9qg5",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "xl6g058f-ok4t-6vn1-yd6w-5p0ogtakput",
      "trc16m7e-6uyz-ut3e-u7bo-872bjpmlyje"
    ],
    "cohortIds": [
      "62dyy0aq-c54y-dqyo-hwzu-po3dazk3f6",
      "h0y4dlve-hawu-r78v-xpys-d4d4k4x8m6u"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "lfmvhyk1-6ogd-ddaw-ggo1-6v1qql91m8r",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "9s4mro0s-jaz3-wr46-jrfy-ozfahcblae",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "gwpltnf5-z86t-dw4z-zvd4-yf2wojg6py",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "updatedAt": "2025-07-18T21:52:47.357Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "l2g6nagg-49a0-yrkm-oifz-jaihcp1i6ib",
    "createdAt": "2025-07-18T21:52:47.357Z",
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
    "id": "jehdawrc-e98k-lm4j-o75l-anrfgd02a8d",
    "createdAt": "2025-07-18T21:52:47.357Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 67,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-18T21:52:47.357Z",
    "token": "token_1"
  }
];


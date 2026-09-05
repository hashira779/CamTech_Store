from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class NotificationRecordDto(BaseModel):
    id: str
    organizationId: Optional[str] = None
    userId: Optional[str] = None
    channel: str
    type: str
    title: str
    message: str
    status: str
    isRead: bool = False
    metadata: Optional[Dict[str, Any]] = None
    sentAt: Optional[str] = None
    readAt: Optional[str] = None
    createdAt: Optional[str] = None

class NotificationConfigDto(BaseModel):
    id: str
    organizationId: str
    telegramEnabled: bool = False
    telegramBotToken: Optional[str] = None
    telegramChatId: Optional[str] = None
    emailEnabled: bool = False
    emailRecipient: Optional[str] = None
    inAppEnabled: bool = True
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class UpdateNotificationConfigInput(BaseModel):
    telegramEnabled: Optional[bool] = None
    telegramBotToken: Optional[str] = None
    telegramChatId: Optional[str] = None
    emailEnabled: Optional[bool] = None
    emailRecipient: Optional[str] = None
    inAppEnabled: Optional[bool] = None

class NotificationStatsDto(BaseModel):
    totalDispatched: int
    unreadInApp: int
    activeChannels: List[str]

class SendNotificationInput(BaseModel):
    channel: Optional[str] = "IN_APP"
    type: Optional[str] = "GENERAL"
    title: str
    message: str
    recipientUserId: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

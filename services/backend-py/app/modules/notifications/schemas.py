from pydantic import BaseModel

class NotificationRecordDto(BaseModel):
    id: str
    channel: str
    type: str
    title: str
    message: str
    status: str
    sentAt: str

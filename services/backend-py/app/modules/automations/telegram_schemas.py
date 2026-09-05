from typing import Literal, Optional
import datetime
from pydantic import BaseModel, Field, field_validator


TelegramBindingType = Literal["USER", "GROUP"]
TelegramRole = Literal["OPERATOR", "BRANCH_MANAGER", "SUPER_ADMIN", "DISPATCHER", "CASHIER"]
TelegramBotPurpose = Literal["SALES", "DELIVERY", "INVENTORY", "FINANCE", "SUPPORT", "GENERAL"]
TelegramBotStatus = Literal["CONNECTED", "DISCONNECTED", "ERROR"]


class TelegramConfigDto(BaseModel):
    enabled: bool
    hasToken: bool
    tokenPreview: Optional[str] = None
    defaultChatId: Optional[str] = None
    botUsername: Optional[str] = None
    updatedAt: Optional[str] = None


class UpdateTelegramConfigInput(BaseModel):
    enabled: Optional[bool] = None
    botToken: Optional[str] = Field(default=None, min_length=20, max_length=255)
    clearToken: bool = False
    defaultChatId: Optional[str] = Field(default=None, max_length=100)

    @field_validator("botToken", "defaultChatId", mode="before")
    @classmethod
    def strip_optional_strings(cls, value):
        return value.strip() if isinstance(value, str) else value


class TelegramBotDto(BaseModel):
    id: str
    organizationId: str
    name: str
    botUsername: Optional[str] = None
    tokenPreview: str
    description: Optional[str] = None
    purpose: TelegramBotPurpose
    defaultChatId: Optional[str] = None
    isActive: bool
    isPrimary: bool
    status: TelegramBotStatus
    lastTestedAt: Optional[str] = None
    createdAt: str
    updatedAt: str


class CreateTelegramBotInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    botToken: str = Field(min_length=20, max_length=255)
    botUsername: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    purpose: TelegramBotPurpose = "GENERAL"
    defaultChatId: Optional[str] = Field(default=None, max_length=100)
    isActive: bool = True
    isPrimary: bool = False

    @field_validator("name", "botToken", "botUsername", "description", "defaultChatId", mode="before")
    @classmethod
    def strip_strings(cls, value):
        return value.strip() if isinstance(value, str) else value


class UpdateTelegramBotInput(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    botToken: Optional[str] = Field(default=None, min_length=20, max_length=255)
    botUsername: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    purpose: Optional[TelegramBotPurpose] = None
    defaultChatId: Optional[str] = Field(default=None, max_length=100)
    isActive: Optional[bool] = None
    isPrimary: Optional[bool] = None

    @field_validator("name", "botToken", "botUsername", "description", "defaultChatId", mode="before")
    @classmethod
    def strip_optional(cls, value):
        return value.strip() if isinstance(value, str) else value


class TelegramBindingInput(BaseModel):
    chatId: str = Field(min_length=1, max_length=100)
    chatTitle: Optional[str] = Field(default=None, max_length=200)
    username: Optional[str] = Field(default=None, max_length=100)
    botId: Optional[str] = Field(default=None, max_length=100)
    bindingType: TelegramBindingType = "GROUP"
    role: TelegramRole = "OPERATOR"

    @field_validator("chatId", "chatTitle", "username", "botId", mode="before")
    @classmethod
    def strip_strings(cls, value):
        return value.strip() if isinstance(value, str) else value


class UpdateTelegramBindingInput(BaseModel):
    chatTitle: Optional[str] = Field(default=None, max_length=200)
    username: Optional[str] = Field(default=None, max_length=100)
    botId: Optional[str] = Field(default=None, max_length=100)
    bindingType: Optional[TelegramBindingType] = None
    role: Optional[TelegramRole] = None
    isActive: Optional[bool] = None


class TelegramBindingDto(BaseModel):
    id: str
    organizationId: str
    botId: Optional[str] = None
    chatId: str
    chatTitle: Optional[str] = None
    username: Optional[str] = None
    bindingType: TelegramBindingType
    role: TelegramRole
    isActive: bool
    createdAt: Optional[str] = None

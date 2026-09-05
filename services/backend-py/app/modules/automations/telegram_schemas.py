from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


TelegramBindingType = Literal["USER", "GROUP"]
TelegramRole = Literal["OPERATOR", "BRANCH_MANAGER", "SUPER_ADMIN"]


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


class TelegramBindingInput(BaseModel):
    chatId: str = Field(min_length=1, max_length=100)
    chatTitle: Optional[str] = Field(default=None, max_length=200)
    username: Optional[str] = Field(default=None, max_length=100)
    bindingType: TelegramBindingType = "GROUP"
    role: TelegramRole = "OPERATOR"

    @field_validator("chatId", "chatTitle", "username", mode="before")
    @classmethod
    def strip_strings(cls, value):
        return value.strip() if isinstance(value, str) else value


class UpdateTelegramBindingInput(BaseModel):
    chatTitle: Optional[str] = Field(default=None, max_length=200)
    username: Optional[str] = Field(default=None, max_length=100)
    bindingType: Optional[TelegramBindingType] = None
    role: Optional[TelegramRole] = None
    isActive: Optional[bool] = None


class TelegramBindingDto(BaseModel):
    id: str
    organizationId: str
    chatId: str
    chatTitle: Optional[str] = None
    username: Optional[str] = None
    bindingType: TelegramBindingType
    role: TelegramRole
    isActive: bool
    boundByUserId: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

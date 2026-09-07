from app.schemas.messages import ActionDirectivePayload, ActionType


def validate_action_directive(directive: ActionDirectivePayload) -> ActionDirectivePayload:
    if directive.action in (ActionType.CLICK, ActionType.TYPE):
        if directive.coords is None:
            raise ValueError(f"{directive.action} requires coords")
    if directive.action == ActionType.TYPE and not directive.text:
        raise ValueError("TYPE requires text")
    if directive.action == ActionType.SCROLL and directive.scroll_delta is None:
        raise ValueError("SCROLL requires scroll_delta")
    if directive.action == ActionType.NAVIGATE and not directive.text:
        raise ValueError("NAVIGATE requires text (URL)")
    return directive
